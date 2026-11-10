#pragma once
// Unités de la fenêtre SDL → DIP, l'unité de CEF (les « points » du proto, partout).
//
// SDL3 compte la fenêtre (taille, position, souris) en « unités de fenêtre » : des POINTS sur
// macOS et Wayland (= DIP), des PIXELS sous Windows et X11, où l'échelle d'affichage (125 %,
// 150 %…) vit à part. CEF attend des DIP et une échelle (pixels par DIP). Par définition de
// SDL (SDL_GetWindowDisplayScale) :
//   échelle d'affichage = densité de pixels × échelle du contenu ;
// d'où deviceScale = l'échelle d'affichage et windowToDip = densité / échelle d'affichage —
// soit exactement (densité, 1) sur macOS, où l'échelle du contenu vaut toujours 1 : rien n'y
// change. Sous Windows à 150 % : (1,5 ; 1/1,5), la page garde sa taille d'Electron.

#include <SDL3/SDL.h>

#include <cmath>

namespace tentacle {

struct WindowScale {
  float deviceScale = 1.0f;  // pixels physiques par DIP (device_scale_factor de CEF)
  float windowToDip = 1.0f;  // DIP par unité de fenêtre SDL
};

inline WindowScale windowScale(SDL_Window* window) {
  float density = SDL_GetWindowPixelDensity(window);
  if (!(density > 0.0f)) density = 1.0f;
  float display = SDL_GetWindowDisplayScale(window);
  if (!(display > 0.0f)) display = density;
  return {display, density / display};
}

// Taille de la zone de contenu en DIP.
inline void windowSizeDip(SDL_Window* window, int& width, int& height) {
  int w = 0, h = 0;
  SDL_GetWindowSize(window, &w, &h);
  const float k = windowScale(window).windowToDip;
  width = int(std::lround(w * k));
  height = int(std::lround(h * k));
}

}  // namespace tentacle
