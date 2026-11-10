#include "lifecycle/drag_hit_test.h"

namespace tentacle::lifecycle {
namespace {

std::vector<DragRegion>& regionsState() {
  static std::vector<DragRegion> regions;
  return regions;
}

// SDL donne le point en unités de fenêtre : des points (= DIP) sur macOS et Wayland, des PIXELS
// sous Windows et X11. Les régions de CEF sont en DIP : on convertit (`shell/window_scale.h` de
// l'axe windows, même formule — densité / échelle d'affichage, 1 sur macOS).
SDL_HitTestResult hitTest(SDL_Window* window, const SDL_Point* point, void*) {
  if (!point) return SDL_HITTEST_NORMAL;
  const float k = windowUnitsToDip(window);
  return isDraggable(regionsState(), point->x * k, point->y * k) ? SDL_HITTEST_DRAGGABLE : SDL_HITTEST_NORMAL;
}

}  // namespace

float windowUnitsToDip(SDL_Window* window) {
  float density = SDL_GetWindowPixelDensity(window);
  if (!(density > 0.0f)) density = 1.0f;
  float display = SDL_GetWindowDisplayScale(window);
  if (!(display > 0.0f)) display = density;
  return density / display;
}

void setDragRegions(std::vector<DragRegion> regions) { regionsState() = std::move(regions); }

const std::vector<DragRegion>& dragRegions() { return regionsState(); }

void installDragHitTest(SDL_Window* window) { SDL_SetWindowHitTest(window, hitTest, nullptr); }

}  // namespace tentacle::lifecycle
