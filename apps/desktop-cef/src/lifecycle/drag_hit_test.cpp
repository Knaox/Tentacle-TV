#include "lifecycle/drag_hit_test.h"

namespace tentacle::lifecycle {
namespace {

std::vector<DragRegion>& regionsState() {
  static std::vector<DragRegion> regions;
  return regions;
}

// SDL donne le point en coordonnées de la fenêtre — celles de la vue de la page (Shell les prend
// pour des points DIP) : les régions de CEF s'y comparent telles quelles.
SDL_HitTestResult hitTest(SDL_Window*, const SDL_Point* point, void*) {
  if (!point) return SDL_HITTEST_NORMAL;
  return isDraggable(regionsState(), point->x, point->y) ? SDL_HITTEST_DRAGGABLE : SDL_HITTEST_NORMAL;
}

}  // namespace

void setDragRegions(std::vector<DragRegion> regions) { regionsState() = std::move(regions); }

const std::vector<DragRegion>& dragRegions() { return regionsState(); }

void installDragHitTest(SDL_Window* window) { SDL_SetWindowHitTest(window, hitTest, nullptr); }

}  // namespace tentacle::lifecycle
