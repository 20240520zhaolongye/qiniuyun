#include "core.h"

#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

int main() {
  try {
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    const std::string input = buffer.str();
    if (input.empty()) {
      throw std::runtime_error("Expected JSON payload on stdin");
    }

    const spriteforge::Json payload = spriteforge::JsonParser(input).parse();
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

    std::cout << spriteforge::stringify(response);
    return 0;
  } catch (const std::exception& error) {
    const spriteforge::Json response(spriteforge::Json::Object{{"error", error.what()}});
    std::cerr << spriteforge::stringify(response);
    return 1;
  }
}
