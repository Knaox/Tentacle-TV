#include "glass/snapshot.h"

namespace tentacle::glass {

nlohmann::json rectJson(const Rect& rect) {
  return {{"x", rect.x}, {"y", rect.y}, {"width", rect.width}, {"height", rect.height}};
}

nlohmann::json liveJson(const std::optional<GlassInspection::Live>& live) {
  if (!live) return nullptr;
  return {{"frame", rectJson(live->frame)}, {"containerAlpha", live->containerAlpha}};
}

nlohmann::json describeRegion(const Region& region, const std::optional<GlassInspection>& native) {
  nlohmann::json out = {
      {"id", region.id},
      {"level", levelName(region.level)},
      {"group", region.group ? nlohmann::json(*region.group) : nlohmann::json(nullptr)},
      {"z", region.z},
      {"css",
       {{"x", region.x}, {"y", region.y}, {"width", region.width}, {"height", region.height}, {"radius", region.radius}}},
      {"frame", native ? rectJson(native->frame) : nlohmann::json(nullptr)},
      {"radius", native ? nlohmann::json(native->radius) : nlohmann::json(nullptr)},
      {"style", native ? nlohmann::json(native->style) : nlohmann::json(nullptr)},
      {"hidden", !native || native->hidden},
      {"live", native ? liveJson(native->live) : nlohmann::json(nullptr)},
  };
  return out;
}

}  // namespace tentacle::glass
