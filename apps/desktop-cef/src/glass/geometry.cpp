#include "glass/geometry.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

#include "glass/validate.h"

namespace tentacle::glass {
namespace {

double factorOf(double zoom) { return std::isfinite(zoom) && zoom > 0 ? zoom : 1; }

}  // namespace

Rect toPoints(const Region& region, double zoom) {
  const double f = factorOf(zoom);
  return {region.x * f, region.y * f, region.width * f, region.height * f};
}

double toPointRadius(const Region& region, double zoom) {
  const double f = factorOf(zoom);
  const double max = std::min(region.width, region.height) * f / 2;
  return std::max(0.0, std::min(region.radius * f, max));
}

Rect toAppKitFrame(const Rect& rect, double containerHeight) {
  return {rect.x, containerHeight - rect.y - rect.height, rect.width, rect.height};
}

bool sameRect(const Rect& a, const Rect& b) {
  const auto close = [](double u, double v) { return std::abs(u - v) < 0.01; };
  return close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);
}

std::optional<Rgba> parseTint(const std::optional<std::string>& hex) {
  if (!hex || !isTint(*hex)) return std::nullopt;
  const unsigned long rgb = std::strtoul(hex->substr(1, 6).c_str(), nullptr, 16);
  const unsigned long alpha = hex->size() == 9 ? std::strtoul(hex->substr(7, 2).c_str(), nullptr, 16) : 255;
  return Rgba{((rgb >> 16) & 0xff) / 255.0, ((rgb >> 8) & 0xff) / 255.0, (rgb & 0xff) / 255.0, alpha / 255.0};
}

int nativeStyle(Level level) { return level == Level::Clear ? 1 : 0; }

std::optional<std::string> stackAnchor(std::vector<Stackable> items, const std::string& key) {
  std::stable_sort(items.begin(), items.end(), [](const Stackable& a, const Stackable& b) {
    return a.z < b.z || (a.z == b.z && a.seq < b.seq);
  });
  const auto it = std::find_if(items.begin(), items.end(), [&](const Stackable& s) { return s.key == key; });
  if (it == items.end() || std::next(it) == items.end()) return std::nullopt;
  return std::next(it)->key;
}

Rect centerOf(const Rect& frame) {
  return {frame.x + frame.width / 2, frame.y + frame.height / 2, 0, 0};
}

}  // namespace tentacle::glass
