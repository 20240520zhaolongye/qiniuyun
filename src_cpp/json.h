#pragma once

#include <cctype>
#include <cstdint>
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace spriteforge {

class Json {
 public:
  using Array = std::vector<Json>;
  using Object = std::map<std::string, Json>;
  using Value = std::variant<std::nullptr_t, bool, double, std::string, Array, Object>;

  Json() : value_(nullptr) {}
  Json(std::nullptr_t) : value_(nullptr) {}
  Json(bool value) : value_(value) {}
  Json(double value) : value_(value) {}
  Json(int value) : value_(static_cast<double>(value)) {}
  Json(uint32_t value) : value_(static_cast<double>(value)) {}
  Json(const char* value) : value_(std::string(value)) {}
  Json(std::string value) : value_(std::move(value)) {}
  Json(Array value) : value_(std::move(value)) {}
  Json(Object value) : value_(std::move(value)) {}

  bool is_null() const { return std::holds_alternative<std::nullptr_t>(value_); }
  bool is_bool() const { return std::holds_alternative<bool>(value_); }
  bool is_number() const { return std::holds_alternative<double>(value_); }
  bool is_string() const { return std::holds_alternative<std::string>(value_); }
  bool is_array() const { return std::holds_alternative<Array>(value_); }
  bool is_object() const { return std::holds_alternative<Object>(value_); }

  bool as_bool(bool fallback = false) const {
    return is_bool() ? std::get<bool>(value_) : fallback;
  }

  double as_number(double fallback = 0) const {
    return is_number() ? std::get<double>(value_) : fallback;
  }

  const std::string& as_string() const {
    if (!is_string()) {
      throw std::runtime_error("JSON value is not a string");
    }
    return std::get<std::string>(value_);
  }

  std::string string_or(const std::string& fallback) const {
    return is_string() ? std::get<std::string>(value_) : fallback;
  }

  const Array& as_array() const {
    if (!is_array()) {
      throw std::runtime_error("JSON value is not an array");
    }
    return std::get<Array>(value_);
  }

  const Object& as_object() const {
    if (!is_object()) {
      throw std::runtime_error("JSON value is not an object");
    }
    return std::get<Object>(value_);
  }

  const Json& get(const std::string& key) const {
    static const Json missing;
    if (!is_object()) {
      return missing;
    }
    const auto& object = std::get<Object>(value_);
    auto found = object.find(key);
    return found == object.end() ? missing : found->second;
  }

  Value value_;
};

class JsonParser {
 public:
  explicit JsonParser(std::string text) : text_(std::move(text)) {}

  Json parse() {
    skip_whitespace();
    Json value = parse_value();
    skip_whitespace();
    if (position_ != text_.size()) {
      throw std::runtime_error("Unexpected trailing JSON content");
    }
    return value;
  }

 private:
  Json parse_value() {
    skip_whitespace();
    if (position_ >= text_.size()) {
      throw std::runtime_error("Unexpected end of JSON");
    }

    const char ch = text_[position_];
    if (ch == '"') return Json(parse_string());
    if (ch == '{') return Json(parse_object());
    if (ch == '[') return Json(parse_array());
    if (ch == 't') return parse_literal("true", Json(true));
    if (ch == 'f') return parse_literal("false", Json(false));
    if (ch == 'n') return parse_literal("null", Json(nullptr));
    if (ch == '-' || std::isdigit(static_cast<unsigned char>(ch))) return Json(parse_number());

    throw std::runtime_error("Unexpected JSON token");
  }

  Json parse_literal(const char* literal, Json value) {
    const std::string expected(literal);
    if (text_.compare(position_, expected.size(), expected) != 0) {
      throw std::runtime_error("Invalid JSON literal");
    }
    position_ += expected.size();
    return value;
  }

  Json::Object parse_object() {
    Json::Object object;
    expect('{');
    skip_whitespace();
    if (peek('}')) {
      position_ += 1;
      return object;
    }

    while (true) {
      skip_whitespace();
      std::string key = parse_string();
      skip_whitespace();
      expect(':');
      object.emplace(std::move(key), parse_value());
      skip_whitespace();
      if (peek('}')) {
        position_ += 1;
        break;
      }
      expect(',');
    }
    return object;
  }

  Json::Array parse_array() {
    Json::Array array;
    expect('[');
    skip_whitespace();
    if (peek(']')) {
      position_ += 1;
      return array;
    }

    while (true) {
      array.push_back(parse_value());
      skip_whitespace();
      if (peek(']')) {
        position_ += 1;
        break;
      }
      expect(',');
    }
    return array;
  }

  std::string parse_string() {
    expect('"');
    std::string result;
    while (position_ < text_.size()) {
      const char ch = text_[position_++];
      if (ch == '"') {
        return result;
      }
      if (ch != '\\') {
        result.push_back(ch);
        continue;
      }
      if (position_ >= text_.size()) {
        throw std::runtime_error("Unterminated JSON escape");
      }
      const char escape = text_[position_++];
      switch (escape) {
        case '"':
        case '\\':
        case '/':
          result.push_back(escape);
          break;
        case 'b':
          result.push_back('\b');
          break;
        case 'f':
          result.push_back('\f');
          break;
        case 'n':
          result.push_back('\n');
          break;
        case 'r':
          result.push_back('\r');
          break;
        case 't':
          result.push_back('\t');
          break;
        case 'u':
          append_unicode_escape(result);
          break;
        default:
          throw std::runtime_error("Invalid JSON escape");
      }
    }
    throw std::runtime_error("Unterminated JSON string");
  }

  void append_unicode_escape(std::string& output) {
    if (position_ + 4 > text_.size()) {
      throw std::runtime_error("Invalid unicode escape");
    }
    unsigned int code = 0;
    for (int index = 0; index < 4; ++index) {
      const char ch = text_[position_++];
      code <<= 4;
      if (ch >= '0' && ch <= '9') code += ch - '0';
      else if (ch >= 'a' && ch <= 'f') code += 10 + ch - 'a';
      else if (ch >= 'A' && ch <= 'F') code += 10 + ch - 'A';
      else throw std::runtime_error("Invalid unicode escape");
    }

    if (code <= 0x7f) {
      output.push_back(static_cast<char>(code));
    } else if (code <= 0x7ff) {
      output.push_back(static_cast<char>(0xc0 | (code >> 6)));
      output.push_back(static_cast<char>(0x80 | (code & 0x3f)));
    } else {
      output.push_back(static_cast<char>(0xe0 | (code >> 12)));
      output.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3f)));
      output.push_back(static_cast<char>(0x80 | (code & 0x3f)));
    }
  }

  double parse_number() {
    const std::size_t start = position_;
    if (peek('-')) position_ += 1;
    consume_digits();
    if (peek('.')) {
      position_ += 1;
      consume_digits();
    }
    if (peek('e') || peek('E')) {
      position_ += 1;
      if (peek('+') || peek('-')) position_ += 1;
      consume_digits();
    }
    return std::stod(text_.substr(start, position_ - start));
  }

  void consume_digits() {
    const std::size_t start = position_;
    while (position_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[position_]))) {
      position_ += 1;
    }
    if (start == position_) {
      throw std::runtime_error("Expected JSON number digit");
    }
  }

  void skip_whitespace() {
    while (position_ < text_.size() && std::isspace(static_cast<unsigned char>(text_[position_]))) {
      position_ += 1;
    }
  }

  bool peek(char expected) const {
    return position_ < text_.size() && text_[position_] == expected;
  }

  void expect(char expected) {
    if (!peek(expected)) {
      throw std::runtime_error("Unexpected JSON character");
    }
    position_ += 1;
  }

  std::string text_;
  std::size_t position_ = 0;
};

inline std::string escape_json_string(const std::string& value) {
  std::string output;
  output.reserve(value.size() + 8);
  for (const unsigned char ch : value) {
    switch (ch) {
      case '"':
        output += "\\\"";
        break;
      case '\\':
        output += "\\\\";
        break;
      case '\b':
        output += "\\b";
        break;
      case '\f':
        output += "\\f";
        break;
      case '\n':
        output += "\\n";
        break;
      case '\r':
        output += "\\r";
        break;
      case '\t':
        output += "\\t";
        break;
      default:
        if (ch < 0x20) {
          const char* digits = "0123456789abcdef";
          output += "\\u00";
          output.push_back(digits[(ch >> 4) & 0xf]);
          output.push_back(digits[ch & 0xf]);
        } else {
          output.push_back(static_cast<char>(ch));
        }
    }
  }
  return output;
}

inline std::string stringify(const Json& value);

inline std::string stringify_object(const Json::Object& object) {
  std::string output = "{";
  bool first = true;
  for (const auto& [key, item] : object) {
    if (!first) {
      output += ",";
    }
    first = false;
    output.push_back('"');
    output += escape_json_string(key);
    output += "\":";
    output += stringify(item);
  }
  output.push_back('}');
  return output;
}

inline std::string stringify_array(const Json::Array& array) {
  std::string output = "[";
  for (std::size_t index = 0; index < array.size(); ++index) {
    if (index > 0) {
      output += ",";
    }
    output += stringify(array[index]);
  }
  output.push_back(']');
  return output;
}

inline std::string stringify(const Json& value) {
  if (value.is_null()) return "null";
  if (value.is_bool()) return value.as_bool() ? "true" : "false";
  if (value.is_number()) {
    const double number = value.as_number();
    std::string text = std::to_string(number);
    while (!text.empty() && text.back() == '0') {
      text.pop_back();
    }
    if (!text.empty() && text.back() == '.') {
      text.pop_back();
    }
    if (text.empty()) {
      text = "0";
    }
    return text;
  }
  if (value.is_string()) {
    return "\"" + escape_json_string(value.as_string()) + "\"";
  }
  if (value.is_array()) {
    return stringify_array(value.as_array());
  }
  return stringify_object(value.as_object());
}

}  // namespace spriteforge
