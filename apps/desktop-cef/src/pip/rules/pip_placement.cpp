#include "pip/rules/pip_placement.h"

#include <algorithm>

namespace tentacle::pip {

Box cornerPlacement(const Frame& frame, Size size, const Box& area) {
  const double margin = kMargin - frame.shadow;
  return {jsRound(area.x + area.width - size.width - margin),
          jsRound(area.y + area.height - size.height - margin), size.width, size.height};
}

Box clampVisible(const Frame& frame, const Box& box, const Box& area) {
  const double shadow = frame.shadow;
  const double x =
      std::max(area.x - shadow, std::min(box.x, area.x + area.width - box.width + shadow));
  const double y =
      std::max(area.y - shadow, std::min(box.y, area.y + area.height - box.height + shadow));
  return {jsRound(x), jsRound(y), box.width, box.height};
}

Box resizeInPlace(const Frame& frame, const Box& before, Size size, const Box& area) {
  const bool right = before.x + before.width / 2 > area.x + area.width / 2;
  const bool bottom = before.y + before.height / 2 > area.y + area.height / 2;
  const double x = right ? before.x + before.width - size.width : before.x;
  const double y = bottom ? before.y + before.height - size.height : before.y;
  return clampVisible(frame, {x, y, size.width, size.height}, area);
}

Box dragTo(const Frame& frame, const Box& start, Point grab, Point cursor, const Box& area) {
  return clampVisible(frame, {cursor.x - grab.x, cursor.y - grab.y, start.width, start.height},
                      area);
}

Box stretchFrom(const Frame& frame, const Box& start, Gesture corner, double dx, double dy,
                double maxVideoWidth) {
  const double inset = frame.inset();
  const bool left = corner == Gesture::topLeft || corner == Gesture::bottomLeft;
  const bool top = corner == Gesture::topLeft || corner == Gesture::topRight;
  const double w0 = start.width - 2 * inset;
  const double h0 = start.height - 2 * inset;
  const double w1 = w0 + (left ? -dx : dx);
  const double h1 = h0 + (top ? -dy : dy);
  const double aspect = w0 / h0;
  double w = (w0 * (w1 * w0 + h1 * h0)) / (w0 * w0 + h0 * h0);
  w = std::min(w, std::max(maxVideoWidth, kMinVideoWidth));
  w = std::max({w, kMinVideoWidth, kMinVideoHeight * aspect});
  const double height = jsRound(w / aspect) + 2 * inset;
  const double width = jsRound(w) + 2 * inset;
  return {left ? start.x + start.width - width : start.x,
          top ? start.y + start.height - height : start.y, width, height};
}

}  // namespace tentacle::pip
