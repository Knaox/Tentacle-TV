#include "pip/rules/pip_motion.h"

#include <algorithm>
#include <cmath>

namespace tentacle::pip {

double easeOutCubic(double t) {
  const double clamped = std::min(std::max(t, 0.0), 1.0);
  return 1 - std::pow(1 - clamped, 3);
}

Box interpolateBox(const Box& from, const Box& to, double t) {
  const auto at = [t](double a, double b) { return jsRound(a + (b - a) * t); };
  return {at(from.x, to.x), at(from.y, to.y), at(from.width, to.width),
          at(from.height, to.height)};
}

Box pictureIn(const Box& area, double aspect) {
  const double ratio = std::isfinite(aspect) && aspect > 0 ? aspect : 16.0 / 9.0;
  const double width = std::min(area.width, area.height * ratio);
  const double height = width / ratio;
  return {jsRound(area.x + (area.width - width) / 2), jsRound(area.y + (area.height - height) / 2),
          jsRound(width), jsRound(height)};
}

Box windowAround(const Frame& frame, const Box& picture) {
  const double inset = frame.inset();
  return {picture.x - inset, picture.y - inset, picture.width + 2 * inset,
          picture.height + 2 * inset};
}

}  // namespace tentacle::pip
