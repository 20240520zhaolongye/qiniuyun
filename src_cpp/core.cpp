#include "core.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <unordered_map>

namespace spriteforge {

const std::vector<Request> kSampleRequests = {
    {"blue_slime_idle", "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG", "monster", "pixel_art", "32x32", "side", "idle", 4, 8, "generic"},
    {"forest_sword_icon", "绿色宝石短剑图标，金属剑刃，木质握柄，适合背包 UI", "icon", "cartoon", "64x64", "front", "static", 1, 8, "generic"},
    {"grass_tile", "明亮草地地面块，带少量小花和泥土边缘，可拼接", "tile", "pixel_art", "32x32", "top_down", "static", 1, 8, "generic"},
    {"fireball_cast", "橙红色火球技能特效，从小火苗逐渐膨胀", "effect", "cartoon", "64x64", "side", "attack", 6, 8, "generic"}};

namespace {

const std::unordered_map<std::string, std::string> kStyleLabels = {
    {"pixel_art", "像素风"},
    {"cartoon", "卡通风"},
    {"hand_drawn", "手绘风"},
    {"dark_fantasy", "暗黑幻想风"},
    {"chibi", "Q版"}};

const std::unordered_map<std::string, std::string> kStyleDetails = {
    {"pixel_art", "低分辨率精灵图，清晰像素边缘，有限色板"},
    {"cartoon", "轮廓清晰，色块干净，比例活泼"},
    {"hand_drawn", "柔和手绘轮廓，适合 2D 游戏的绘制质感"},
    {"dark_fantasy", "高对比暗色氛围，剪影明确，幻想题材色彩克制"},
    {"chibi", "头身比例可爱，体型紧凑，适合轻量游戏角色"}};

const std::unordered_map<std::string, std::string> kAssetTypeHints = {
    {"monster", "敌人怪物精灵"},
    {"character", "可操控角色精灵"},
    {"prop", "可收集或可交互道具"},
    {"icon", "方形 UI 图标"},
    {"tile", "可拼接地图瓦片"},
    {"effect", "技能或打击特效"}};

std::string to_lower(std::string text) {
  for (char& ch : text) {
    ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
  }
  return text;
}

std::vector<std::string> split_palette(const std::string& text) {
  std::vector<std::string> output;
  std::string token;
  std::stringstream stream(text);
  while (std::getline(stream, token, ',')) {
    if (!token.empty()) {
      output.push_back(token);
    }
  }
  return output;
}

std::string join_palette(const std::vector<std::string>& colors) {
  std::ostringstream output;
  for (std::size_t index = 0; index < colors.size(); ++index) {
    if (index > 0) {
      output << ", ";
    }
    output << colors[index];
  }
  return output.str();
}

Json palette_to_json(const std::vector<std::string>& colors) {
  Json::Array array;
  for (const auto& color : colors) {
    array.emplace_back(color);
  }
  return Json(std::move(array));
}

std::vector<std::string> palette_from_json(const Json& input) {
  if (input.is_array()) {
    std::vector<std::string> colors;
    for (const auto& item : input.as_array()) {
      if (item.is_string()) {
        colors.push_back(item.as_string());
      }
    }
    return colors;
  }
  return split_palette(input.string_or(""));
}

}  // namespace

int clamp_int(int value, int min_value, int max_value) {
  return std::max(min_value, std::min(max_value, value));
}

std::pair<int, int> parse_size(const std::string& size) {
  const auto separator = size.find('x');
  if (separator == std::string::npos) {
    throw std::runtime_error("Invalid size: " + size);
  }
  return {std::stoi(size.substr(0, separator)), std::stoi(size.substr(separator + 1))};
}

std::string sanitize_file_name(const std::string& value) {
  std::string output;
  output.reserve(value.size());
  for (unsigned char ch : value) {
    if (std::isalnum(ch) || ch == '_' || ch == '-' || ch >= 0x80) {
      output.push_back(static_cast<char>(ch));
    } else if (std::isspace(ch)) {
      output.push_back('_');
    }
  }
  if (output.empty()) {
    return "asset";
  }
  if (output.size() > 64) {
    output.resize(64);
  }
  return output;
}

std::vector<std::string> normalize_palette(const Json& input) {
  const std::vector<std::string> raw = palette_from_json(input);
  std::vector<std::string> normalized;
  for (std::string color : raw) {
    color.erase(std::remove_if(color.begin(), color.end(), [](unsigned char ch) { return std::isspace(ch); }), color.end());
    if (color.size() == 7 && color[0] == '#') {
      bool valid = true;
      for (std::size_t index = 1; index < color.size(); ++index) {
        if (!std::isxdigit(static_cast<unsigned char>(color[index]))) {
          valid = false;
          break;
        }
      }
      if (valid) {
        for (char& ch : color) {
          ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
        }
        normalized.push_back(color);
      }
    }
  }
  if (normalized.empty()) {
    return {"#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"};
  }
  return normalized;
}

std::string build_prompt(const Request& request, const StyleProfile& style_profile) {
  const auto [width, height] = parse_size(request.size);
  const std::string style_label = kStyleLabels.count(request.style) ? kStyleLabels.at(request.style) : kStyleLabels.at("pixel_art");
  const std::string type_hint = kAssetTypeHints.count(request.assetType) ? kAssetTypeHints.at(request.assetType) : "2D game asset";
  const std::string details = kStyleDetails.count(request.style) ? kStyleDetails.at(request.style) : kStyleDetails.at("pixel_art");

  std::ostringstream prompt;
  prompt << "生成一个 " << width << "x" << height << " 的" << style_label << " 2D 游戏素材。\n";
  prompt << "素材类型：" << request.assetType << "（" << type_hint << "）\n";
  prompt << "素材描述：" << request.description << "\n";
  prompt << "视角：" << request.view << "\n";
  prompt << "背景：透明背景\n";
  prompt << "美术方向：" << details << "；" << style_profile.worldKeywords << "\n";
  prompt << "主色板：" << join_palette(style_profile.colorPalette) << "\n";
  prompt << "线条风格：" << style_profile.lineStyle << "\n";
  prompt << "光照方式：" << style_profile.lighting << "\n";
  prompt << "动画：" ;
  if (request.frameCount > 1) {
    prompt << request.animation << " 动画，" << request.frameCount << " 帧";
  } else {
    prompt << "单帧静态素材";
  }
  prompt << "\n\n生成要求：\n";
  prompt << "- 可直接用于 2D 游戏开发\n";
  prompt << "- 主体居中\n";
  prompt << "- 剪影清晰，易于识别\n";
  prompt << "- 与项目风格保持一致\n";
  prompt << "- 透明背景\n";
  prompt << "- 适合 Unity、Godot 和 Cocos Creator 工作流\n";
  prompt << "- 不要文字、水印或复杂背景\n\n";
  prompt << "负面约束：" << style_profile.negativePrompt;
  return prompt.str();
}

unsigned int make_seed(const Json& input) {
  const std::string text = stringify(input);
  unsigned int hash = 2166136261u;
  for (unsigned char ch : text) {
    hash ^= ch;
    hash *= 16777619u;
  }
  return hash;
}

Plan create_asset_plan(const Request& request, const StyleProfile& style_profile) {
  const auto [width, height] = parse_size(request.size);
  const std::vector<std::string> effective_palette = normalize_palette(palette_to_json(style_profile.colorPalette));
  const int frame_count = clamp_int(request.frameCount, 1, 8);
  const int fps = clamp_int(request.fps, 1, 24);
  const Json seed_input = Json::Object{
      {"request", Json::Object{{"assetName", request.assetName},
                                 {"description", request.description},
                                 {"assetType", request.assetType},
                                 {"style", request.style},
                                 {"size", request.size},
                                 {"view", request.view},
                                 {"animation", request.animation},
                                 {"frameCount", frame_count},
                                 {"fps", fps},
                                 {"exportTarget", request.exportTarget}}},
      {"palette", palette_to_json(effective_palette)}};

  Plan plan;
  plan.seed = make_seed(seed_input);
  plan.prompt = build_prompt(request, style_profile);
  plan.metadata = Json::Object{
      {"assetName", sanitize_file_name(request.assetName)},
      {"assetType", request.assetType},
      {"style", request.style},
      {"frameWidth", width},
      {"frameHeight", height},
      {"frameCount", frame_count},
      {"animationName", request.animation},
      {"fps", fps},
      {"pivot", Json::Object{{"x", 0.5}, {"y", 0.5}}},
      {"exportTarget", request.exportTarget.empty() ? "generic" : request.exportTarget},
      {"generatedBy", "SpriteForge C++ Generator"},
      {"transparentBackground", true}};
  plan.draw = Json::Object{
      {"palette", palette_to_json(effective_palette)},
      {"renderMode", request.style == "pixel_art" ? "pixel" : "smooth"},
      {"assetType", request.assetType},
      {"animation", request.animation},
      {"view", request.view}};
  return plan;
}

std::string generate_export_json(const Plan& plan) {
  const int frame_count = static_cast<int>(plan.metadata.at("frameCount").as_number(1));
  const int frame_width = static_cast<int>(plan.metadata.at("frameWidth").as_number(32));
  const int frame_height = static_cast<int>(plan.metadata.at("frameHeight").as_number(32));
  const int fps = static_cast<int>(plan.metadata.at("fps").as_number(8));
  Json::Array frames;
  const int duration = static_cast<int>(std::lround(1000.0 / std::max(1, fps)));
  for (int index = 0; index < frame_count; ++index) {
    frames.emplace_back(Json::Object{{"index", index},
                                     {"x", index * frame_width},
                                     {"y", 0},
                                     {"width", frame_width},
                                     {"height", frame_height},
                                     {"durationMs", duration}});
  }

  Json::Object output = plan.metadata;
  const std::string asset_name = plan.metadata.at("assetName").as_string();
  output["files"] = Json::Object{{"png", asset_name + ".png"},
                                  {"spriteSheet", asset_name + "_sheet.png"},
                                  {"metadata", asset_name + ".json"}};
  output["frames"] = Json(std::move(frames));
  return stringify(Json(std::move(output)));
}

Request request_from_json(const Json& json) {
  Request request;
  request.assetName = json.get("assetName").string_or("asset");
  request.description = json.get("description").string_or("");
  request.assetType = json.get("assetType").string_or("monster");
  request.style = json.get("style").string_or("pixel_art");
  request.size = json.get("size").string_or("32x32");
  request.view = json.get("view").string_or("side");
  request.animation = json.get("animation").string_or("idle");
  request.frameCount = static_cast<int>(json.get("frameCount").as_number(1));
  request.fps = static_cast<int>(json.get("fps").as_number(8));
  request.exportTarget = json.get("exportTarget").string_or("generic");
  return request;
}

StyleProfile style_profile_from_json(const Json& json) {
  StyleProfile profile;
  profile.styleName = json.get("styleName").string_or("bright_pixel_fantasy");
  profile.colorPalette = normalize_palette(json.get("colorPalette"));
  profile.lineStyle = json.get("lineStyle").string_or("clean dark outline");
  profile.lighting = json.get("lighting").string_or("simple top-left cel shading");
  profile.worldKeywords = json.get("worldKeywords").string_or("");
  profile.negativePrompt = json.get("negativePrompt").string_or("");
  return profile;
}

Json plan_to_json(const Plan& plan) {
  Json::Object output = plan.metadata;
  const std::string asset_name = plan.metadata.at("assetName").as_string();
  output["files"] = Json::Object{{"png", asset_name + ".png"},
                                  {"spriteSheet", asset_name + "_sheet.png"},
                                  {"metadata", asset_name + ".json"}};

  Json::Array frames;
  const int frame_count = static_cast<int>(plan.metadata.at("frameCount").as_number(1));
  const int frame_width = static_cast<int>(plan.metadata.at("frameWidth").as_number(32));
  const int frame_height = static_cast<int>(plan.metadata.at("frameHeight").as_number(32));
  const int fps = static_cast<int>(plan.metadata.at("fps").as_number(8));
  const int duration = static_cast<int>(std::lround(1000.0 / std::max(1, fps)));
  for (int index = 0; index < frame_count; ++index) {
    frames.emplace_back(Json::Object{{"index", index},
                                     {"x", index * frame_width},
                                     {"y", 0},
                                     {"width", frame_width},
                                     {"height", frame_height},
                                     {"durationMs", duration}});
  }
  output["frames"] = Json(std::move(frames));
  return Json(std::move(output));
}

}  // namespace spriteforge
