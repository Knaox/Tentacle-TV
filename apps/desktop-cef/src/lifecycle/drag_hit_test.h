#pragma once
// Le test de clic de la fenêtre d'après les régions `app-region` de la page : un clic dans une
// région `drag` déplace la fenêtre (SDL_SetWindowHitTest : macOS, Windows WM_NCHITTEST, X11
// _NET_WM_MOVERESIZE, Wayland xdg_toplevel.move). Fil principal.

#include <SDL3/SDL.h>

#include <vector>

#include "lifecycle/drag_regions.h"

namespace tentacle::lifecycle {

/// Les régions du cadre principal, en points de la vue (CefDragHandler).
void setDragRegions(std::vector<DragRegion> regions);
/// Pose le test de clic sur la fenêtre (une fois, à sa préparation).
void installDragHitTest(SDL_Window* window);
/// Diagnostic des bancs : les régions connues et le verdict d'un point.
const std::vector<DragRegion>& dragRegions();

}  // namespace tentacle::lifecycle
