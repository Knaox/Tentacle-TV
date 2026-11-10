#pragma once
// Pièces internes du PiP sur SDL3 (pip_sdl_window.cpp, pip_sdl_platform.cpp).

#include <SDL3/SDL.h>

#include "pip/sdl/pip_sdl.h"

namespace tentacle::pip::sdl {

/// De la coordonnée SDL (pixels sous Windows/X11, points ailleurs) au point (DIP).
double dipFactor(SDL_Window* window);
inline Box toDip(const SDL_Rect& r, double k) {
  return {r.x / k, r.y / k, r.w / k, r.h / k};
}

/// Le curseur de CEF → celui du système (comme Shell::setCursor).
SDL_SystemCursor systemCursor(int cefCursorType);

/// La fenêtre PiP sur SDL ; `host` donne l'échelle des coordonnées.
std::unique_ptr<Window> createWindow(SDL_Window* host, const Options& options, const Box& box,
                                     Mode mode, const std::string& caption, PageInput input);
void setWindowCursor(Window& window, int cefCursorType);

}  // namespace tentacle::pip::sdl
