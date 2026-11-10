#pragma once
// L'image fantôme d'un glisser interne : celle que Blink fournit (déjà translucide), dans une
// petite fenêtre « bulle » de SDL (sans focus, transparente à la souris) qui suit le curseur,
// comme l'image de la session de glisser d'AppKit ou d'OLE sous Electron. Elle naît et meurt
// avec le geste.

#include <SDL3/SDL.h>

#include "include/cef_image.h"

namespace tentacle {

class DragGhost {
 public:
  /// nullptr si l'image est vide ou si l'OS refuse la fenêtre (le glisser marche sans).
  static DragGhost* create(SDL_Window* parent, CefRefPtr<CefImage> image, const CefPoint& hotspot);
  ~DragGhost();
  /// Position du curseur, en points de la fenêtre parente.
  void moveTo(float x, float y);

 private:
  DragGhost() = default;
  SDL_Window* window_ = nullptr;
  SDL_Renderer* renderer_ = nullptr;
  SDL_Texture* texture_ = nullptr;
  CefPoint hotspot_;
};

}  // namespace tentacle
