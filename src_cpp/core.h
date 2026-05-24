#pragma once

#include "json.h"

#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace spriteforge {

struct Request {
  std::string assetName;
  std::string description;
  std::string assetType;
  std::string style;
  std::string size;
  std::string view;
  std::string animation;
  int frameCount = 1;
  int fps = 8;
  std::string exportTarget = "generic";
};

struct StyleProfile {
  std::string styleName;
  std::vector<std::string> colorPalette;
  std::string lineStyle;
  std::string lighting;
  std::string worldKeywords;
  std::string negativePrompt;
};

struct Plan {
  unsigned int seed = 0;
  std::string prompt;
  Json::Object metadata;
  Json::Object draw;
};

extern const std::vector<Request> kSampleRequests;

int clamp_int(int value, int min_value, int max_value);
std::pair<int, int> parse_size(const std::string& size);
std::string sanitize_file_name(const std::string& value);
std::vector<std::string> normalize_palette(const Json& input);
std::string build_prompt(const Request& request, const StyleProfile& style_profile);
unsigned int make_seed(const Json& input);
Plan create_asset_plan(const Request& request, const StyleProfile& style_profile);
std::string generate_export_json(const Plan& plan);

Request request_from_json(const Json& json);
StyleProfile style_profile_from_json(const Json& json);
Json plan_to_json(const Plan& plan);

}  // namespace spriteforge
