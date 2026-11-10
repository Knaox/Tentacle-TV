#include "lifecycle/drag_regions.h"

namespace tentacle::lifecycle {

bool isDraggable(const std::vector<DragRegion>& regions, double x, double y) {
  bool draggable = false;
  for (const auto& r : regions) {
    if (r.width <= 0 || r.height <= 0) continue;
    const bool inside = x >= r.x && y >= r.y && x < double(r.x) + r.width && y < double(r.y) + r.height;
    if (inside) draggable = r.draggable;  // union pour `drag`, différence pour `no-drag`
  }
  return draggable;
}

}  // namespace tentacle::lifecycle
