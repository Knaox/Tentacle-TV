#include "shell/drag_ghost.h"

#include <cmath>
#include <vector>

#ifdef __linux__
#include "platform/linux/overlay_linux.h"
#endif

namespace tentacle {

#ifdef __linux__
// Linux : l'image est posée par-dessus la page dans le contexte GL du compositeur
// (platform/linux/overlay_linux.h) — jamais une fenêtre SDL_Renderer, dont la destruction en fin
// de geste terminait l'affichage EGL de l'app (9a99daaf6). Elle ne sort pas de la fenêtre.
DragGhost* DragGhost::create(SDL_Window* parent, CefRefPtr<CefImage> image,
                             const CefPoint& hotspot) {
  if (!image || image->IsEmpty()) return nullptr;
  platform::OverlayHost* host = platform::overlayHost(parent);
  if (!host) return nullptr;
  float scale = SDL_GetWindowDisplayScale(parent);
  if (scale <= 0) scale = 1.0f;
  int pw = 0, ph = 0;
  CefRefPtr<CefBinaryValue> pixels = image->GetAsBitmap(
      scale, CEF_COLOR_TYPE_BGRA_8888, CEF_ALPHA_TYPE_PREMULTIPLIED, pw, ph);
  if (!pixels || pw <= 0 || ph <= 0) return nullptr;
  std::vector<uint8_t> buffer(pixels->GetSize());
  pixels->GetData(buffer.data(), buffer.size(), 0);
  if (buffer.size() < size_t(pw) * size_t(ph) * 4) return nullptr;
  // Hors de la fenêtre tant que moveTo n'a pas dit où est le curseur.
  if (!host->setOverlay(platform::OverlaySlot::dragGhost, buffer.data(), pw, ph, pw * 4, -pw, -ph)) {
    return nullptr;
  }
  auto* g = new DragGhost();
  g->window_ = parent;
  // Le point chaud est en DIP, la pile en pixels.
  g->hotspot_ = CefPoint(int(std::lround(hotspot.x * scale)), int(std::lround(hotspot.y * scale)));
  return g;
}

DragGhost::~DragGhost() {
  if (auto* host = platform::overlayHost(window_)) host->clearOverlay(platform::OverlaySlot::dragGhost);
}

void DragGhost::moveTo(float x, float y) {
  auto* host = platform::overlayHost(window_);
  if (!host) return;
  const float density = SDL_GetWindowPixelDensity(window_) > 0 ? SDL_GetWindowPixelDensity(window_) : 1.0f;
  host->moveOverlay(platform::OverlaySlot::dragGhost, int(std::lround(x * density)) - hotspot_.x,
                    int(std::lround(y * density)) - hotspot_.y);
}
#else
DragGhost* DragGhost::create(SDL_Window* parent, CefRefPtr<CefImage> image,
                             const CefPoint& hotspot) {
  if (!image || image->IsEmpty()) return nullptr;
  const int w = int(image->GetWidth()), h = int(image->GetHeight());  // points (DIP)
  if (w <= 0 || h <= 0) return nullptr;
  float scale = SDL_GetWindowDisplayScale(parent);
  if (scale <= 0) scale = 1.0f;
  int pw = 0, ph = 0;
  CefRefPtr<CefBinaryValue> pixels = image->GetAsBitmap(
      scale, CEF_COLOR_TYPE_RGBA_8888, CEF_ALPHA_TYPE_PREMULTIPLIED, pw, ph);
  if (!pixels || pw <= 0 || ph <= 0) return nullptr;

  auto* g = new DragGhost();
  g->hotspot_ = hotspot;
  g->window_ = SDL_CreatePopupWindow(parent, 0, 0, w, h,
                                     SDL_WINDOW_TOOLTIP | SDL_WINDOW_TRANSPARENT |
                                         SDL_WINDOW_HIGH_PIXEL_DENSITY);
  if (g->window_) g->renderer_ = SDL_CreateRenderer(g->window_, nullptr);
  if (g->renderer_) {
    g->texture_ = SDL_CreateTexture(g->renderer_, SDL_PIXELFORMAT_RGBA32,
                                    SDL_TEXTUREACCESS_STATIC, pw, ph);
  }
  if (!g->texture_) {
    delete g;
    return nullptr;
  }
  std::vector<uint8_t> buffer(pixels->GetSize());
  pixels->GetData(buffer.data(), buffer.size(), 0);
  SDL_UpdateTexture(g->texture_, nullptr, buffer.data(), pw * 4);
  SDL_SetTextureBlendMode(g->texture_, SDL_BLENDMODE_BLEND_PREMULTIPLIED);
  SDL_SetRenderDrawColor(g->renderer_, 0, 0, 0, 0);
  SDL_RenderClear(g->renderer_);
  SDL_RenderTexture(g->renderer_, g->texture_, nullptr, nullptr);
  SDL_RenderPresent(g->renderer_);
  return g;
}

DragGhost::~DragGhost() {
  if (texture_) SDL_DestroyTexture(texture_);
  if (renderer_) SDL_DestroyRenderer(renderer_);
  if (window_) SDL_DestroyWindow(window_);
}

void DragGhost::moveTo(float x, float y) {
  if (!window_) return;
  SDL_SetWindowPosition(window_, int(std::lround(x)) - hotspot_.x, int(std::lround(y)) - hotspot_.y);
}
#endif

}  // namespace tentacle
