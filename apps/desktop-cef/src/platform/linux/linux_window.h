#pragma once
// La fenêtre SDL3 telle que Linux la voit : Wayland (wl_display + wl_surface) ou X11
// (Display* + Window). C'est ce que platform::nativeWindow() rend sous Linux (AppContext::
// nativeWindow, createVideoSurface) : un pointeur vers CETTE structure, jamais une poignée nue.

#include <SDL3/SDL.h>

#include <cstdint>

struct wl_display;
struct wl_surface;

namespace tentacle::platform {

struct LinuxWindow {
  SDL_Window* sdl = nullptr;
  bool wayland = false;              // sinon X11 (XWayland compris)
  wl_display* wlDisplay = nullptr;   // Wayland
  wl_surface* wlSurface = nullptr;   // Wayland : la surface de la page (et de son EGL)
  void* x11Display = nullptr;        // X11 : Display*
  uint64_t x11Window = 0;            // X11 : Window
};

// La description de `window`, remplie à la première demande (fil principal).
LinuxWindow* linuxWindow(SDL_Window* window);
// Le pilote vidéo de SDL est-il Wayland ? (« wayland » / « x11 »)
bool sdlIsWayland();

}  // namespace tentacle::platform
