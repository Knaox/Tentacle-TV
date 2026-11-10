#include "pip/rules/pip_resize_guard.h"

#include <algorithm>

#include "pip/rules/pip_placement.h"

namespace tentacle::pip {

Size boundedSize(const Frame& frame, double width, double aspect, double maxVideoWidth) {
  double video = std::min(width - 2 * frame.inset(), std::max(maxVideoWidth, kMinVideoWidth));
  video = std::max({video, kMinVideoWidth, kMinVideoHeight * aspect});
  return windowSize(frame, video, video / aspect);
}

Box guardResize(const Frame& frame, Mode mode, const Box& current, const Box& next,
                double aspect, double maxVideoWidth, const Box& dockArea) {
  const Size size = boundedSize(frame, next.width, aspect, maxVideoWidth);
  if (mode == Mode::docked) return cornerPlacement(frame, size, dockArea);
  // Flottant : le bord que la main ne tire pas reste en place.
  const double x = next.x != current.x ? current.x + current.width - size.width : current.x;
  const double y = next.y != current.y ? current.y + current.height - size.height : current.y;
  return {x, y, size.width, size.height};
}

}  // namespace tentacle::pip
