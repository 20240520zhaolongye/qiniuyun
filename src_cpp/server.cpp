#include "core.h"

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <algorithm>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>

namespace {

constexpr int kBacklog = 16;

std::string get_env_or(const char* name, const std::string& fallback) {
  const char* value = std::getenv(name);
  return value && *value ? value : fallback;
}

std::string current_directory() {
  char buffer[MAX_PATH];
  const DWORD length = GetCurrentDirectoryA(MAX_PATH, buffer);
  if (length == 0 || length >= MAX_PATH) {
    throw std::runtime_error("Unable to resolve current directory");
  }
  return std::string(buffer, length);
}

std::string join_path(const std::string& root, const std::string& relative) {
  if (relative.empty()) return root;
  const char last = root[root.size() - 1];
  return root + (last == '\\' || last == '/' ? "" : "\\") + relative;
}

bool file_exists(const std::string& path) {
  const DWORD attributes = GetFileAttributesA(path.c_str());
  return attributes != INVALID_FILE_ATTRIBUTES && !(attributes & FILE_ATTRIBUTE_DIRECTORY);
}

std::string read_file(const std::string& path) {
  std::ifstream file(path, std::ios::binary);
  if (!file) {
    throw std::runtime_error("Unable to read file");
  }
  std::ostringstream buffer;
  buffer << file.rdbuf();
  return buffer.str();
}

std::string extension_of(const std::string& path) {
  const auto dot = path.find_last_of('.');
  if (dot == std::string::npos) return "";
  return path.substr(dot);
}

std::string content_type(const std::string& path) {
  const std::string ext = extension_of(path);
  if (ext == ".html") return "text/html; charset=utf-8";
  if (ext == ".css") return "text/css; charset=utf-8";
  if (ext == ".js") return "text/javascript; charset=utf-8";
  if (ext == ".json") return "application/json; charset=utf-8";
  if (ext == ".png") return "image/png";
  if (ext == ".svg") return "image/svg+xml";
  if (ext == ".ico") return "image/x-icon";
  return "application/octet-stream";
}

std::string url_decode(const std::string& value) {
  std::string output;
  for (std::size_t index = 0; index < value.size(); ++index) {
    if (value[index] == '%' && index + 2 < value.size()) {
      output.push_back(static_cast<char>(std::stoi(value.substr(index + 1, 2), nullptr, 16)));
      index += 2;
    } else if (value[index] == '+') {
      output.push_back(' ');
    } else {
      output.push_back(value[index]);
    }
  }
  return output;
}

std::string reason_phrase(int status) {
  switch (status) {
    case 200:
      return "OK";
    case 400:
      return "Bad Request";
    case 404:
      return "Not Found";
    case 405:
      return "Method Not Allowed";
    case 500:
      return "Internal Server Error";
    default:
      return "OK";
  }
}

void send_response(SOCKET client, int status, const std::string& type, const std::string& body) {
  std::ostringstream response;
  response << "HTTP/1.1 " << status << " " << reason_phrase(status) << "\r\n";
  response << "Content-Type: " << type << "\r\n";
  response << "Content-Length: " << body.size() << "\r\n";
  response << "Cache-Control: no-store\r\n";
  response << "Connection: close\r\n\r\n";
  response << body;
  const std::string text = response.str();
  send(client, text.c_str(), static_cast<int>(text.size()), 0);
}

std::string resolve_static_path(const std::string& root, const std::string& target) {
  std::string path_text = target;
  const auto query = path_text.find('?');
  if (query != std::string::npos) {
    path_text = path_text.substr(0, query);
  }
  path_text = url_decode(path_text);
  std::replace(path_text.begin(), path_text.end(), '/', '\\');
  while (!path_text.empty() && path_text[0] == '\\') {
    path_text.erase(path_text.begin());
  }
  if (path_text.empty()) {
    path_text = "index.html";
  }
  if (path_text.find("..") != std::string::npos || path_text.find(':') != std::string::npos) {
    return "";
  }
  std::string candidate = join_path(root, path_text);
  if (!file_exists(candidate)) {
    candidate = join_path(root, "index.html");
  }
  return candidate;
}

std::unordered_map<std::string, std::string> parse_headers(std::istringstream& stream) {
  std::unordered_map<std::string, std::string> headers;
  std::string line;
  while (std::getline(stream, line) && line != "\r") {
    if (!line.empty() && line.back() == '\r') {
      line.pop_back();
    }
    const auto colon = line.find(':');
    if (colon == std::string::npos) {
      continue;
    }
    std::string key = line.substr(0, colon);
    std::string value = line.substr(colon + 1);
    while (!value.empty() && value.front() == ' ') {
      value.erase(value.begin());
    }
    std::transform(key.begin(), key.end(), key.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    headers[key] = value;
  }
  return headers;
}

std::string receive_request(SOCKET client) {
  std::string data;
  char buffer[4096];
  while (data.find("\r\n\r\n") == std::string::npos) {
    const int received = recv(client, buffer, sizeof(buffer), 0);
    if (received <= 0) return data;
    data.append(buffer, received);
  }

  const auto header_end = data.find("\r\n\r\n");
  std::istringstream header_stream(data.substr(0, header_end + 2));
  std::string request_line;
  std::getline(header_stream, request_line);
  const auto headers = parse_headers(header_stream);
  const int content_length = headers.count("content-length") ? std::stoi(headers.at("content-length")) : 0;
  while (static_cast<int>(data.size() - header_end - 4) < content_length) {
    const int received = recv(client, buffer, sizeof(buffer), 0);
    if (received <= 0) break;
    data.append(buffer, received);
  }
  return data;
}

void handle_api_plan(SOCKET client, const std::string& body) {
  try {
    const spriteforge::Json payload = spriteforge::JsonParser(body).parse();
    const spriteforge::Request request = spriteforge::request_from_json(payload.get("request"));
    const spriteforge::StyleProfile style = spriteforge::style_profile_from_json(payload.get("styleProfile"));
    const spriteforge::Plan plan = spriteforge::create_asset_plan(request, style);
    const spriteforge::Json response(spriteforge::Json::Object{
        {"seed", plan.seed},
        {"prompt", plan.prompt},
        {"metadata", spriteforge::Json(plan.metadata)},
        {"draw", spriteforge::Json(plan.draw)},
        {"export", spriteforge::plan_to_json(plan)},
        {"exportJson", spriteforge::generate_export_json(plan)}});
    send_response(client, 200, "application/json; charset=utf-8", spriteforge::stringify(response));
  } catch (const std::exception& error) {
    send_response(client, 400, "application/json; charset=utf-8",
                  "{\"error\":\"" + spriteforge::escape_json_string(error.what()) + "\"}");
  }
}

void handle_health(SOCKET client) {
  send_response(client, 200, "application/json; charset=utf-8",
                "{\"status\":\"ok\",\"service\":\"SpriteForge C++\",\"version\":\"1.1.0\"}");
}

void handle_client(SOCKET client, const std::string& root) {
  try {
    const std::string raw = receive_request(client);
    const auto header_end = raw.find("\r\n\r\n");
    if (header_end == std::string::npos) {
      send_response(client, 400, "text/plain; charset=utf-8", "Bad request");
      return;
    }

    std::istringstream stream(raw.substr(0, header_end));
    std::string method;
    std::string target;
    std::string version;
    stream >> method >> target >> version;
    const std::string body = raw.substr(header_end + 4);

    if (target == "/api/plan") {
      if (method != "POST") {
        send_response(client, 405, "text/plain; charset=utf-8", "Method not allowed");
        return;
      }
      handle_api_plan(client, body);
      return;
    }

    if (target == "/api/health") {
      if (method != "GET") {
        send_response(client, 405, "text/plain; charset=utf-8", "Method not allowed");
        return;
      }
      handle_health(client);
      return;
    }

    if (method != "GET") {
      send_response(client, 405, "text/plain; charset=utf-8", "Method not allowed");
      return;
    }

    const std::string file_path = resolve_static_path(root, target);
    if (file_path.empty() || !file_exists(file_path)) {
      send_response(client, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }
    send_response(client, 200, content_type(file_path), read_file(file_path));
  } catch (const std::exception& error) {
    send_response(client, 500, "text/plain; charset=utf-8", error.what());
  }
}

}  // namespace

int main() {
  const std::string root = current_directory();
  const int port = std::stoi(get_env_or("PORT", "5173"));

  WSADATA data;
  if (WSAStartup(MAKEWORD(2, 2), &data) != 0) {
    std::cerr << "WSAStartup failed\n";
    return 1;
  }

  SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (server == INVALID_SOCKET) {
    std::cerr << "socket failed\n";
    WSACleanup();
    return 1;
  }

  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(static_cast<unsigned short>(port));
  address.sin_addr.s_addr = inet_addr("127.0.0.1");

  if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
    std::cerr << "bind failed on port " << port << "\n";
    closesocket(server);
    WSACleanup();
    return 1;
  }

  if (listen(server, kBacklog) == SOCKET_ERROR) {
    std::cerr << "listen failed\n";
    closesocket(server);
    WSACleanup();
    return 1;
  }

  std::cout << "SpriteForge C++ server is running at http://127.0.0.1:" << port << std::endl;

  while (true) {
    SOCKET client = accept(server, nullptr, nullptr);
    if (client == INVALID_SOCKET) continue;
    handle_client(client, root);
    closesocket(client);
  }

  closesocket(server);
  WSACleanup();
  return 0;
}
