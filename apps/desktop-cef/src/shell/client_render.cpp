// Rendu hors écran : CEF peint dans une IOSurface partagée (OnAcceleratedPaint, GPU) ;
// le compositeur la copie et la présente. OnPaint (logiciel) reste comme repli.

#include <algorithm>
#include <cstdio>
#include <cstdlib>

#include "shell/client.h"

namespace tentacle {

void Client::GetViewRect(CefRefPtr<CefBrowser> browser, CefRect& rect) {
  int w = 0, h = 0;
  host_->viewSizePt(w, h);
  rect = CefRect(0, 0, std::max(w, 1), std::max(h, 1));
}

bool Client::GetScreenInfo(CefRefPtr<CefBrowser> browser, CefScreenInfo& info) {
  int w = 0, h = 0;
  host_->viewSizePt(w, h);
  info.device_scale_factor = host_->deviceScale();
  info.rect = info.available_rect = CefRect(0, 0, w, h);
  info.depth = 24;
  info.depth_per_component = 8;
  return true;
}

bool Client::GetScreenPoint(CefRefPtr<CefBrowser> browser, int viewX, int viewY, int& screenX,
                            int& screenY) {
  host_->viewToScreen(viewX, viewY, screenX, screenY);
  return true;
}

void Client::OnPopupShow(CefRefPtr<CefBrowser> browser, bool show) {
  popupVisible_ = show;
  if (std::getenv("TENTACLE_INPUT_LOG")) std::fprintf(stderr, "[popup] %s\n", show ? "ouverte" : "fermée");
  if (!show) host_->webLayer()->setPopup(false, {});
  // La couche web ne garde pas de copie de la vue hors popup : on redemande une image.
  browser->GetHost()->Invalidate(PET_VIEW);
}

void Client::OnPopupSize(CefRefPtr<CefBrowser> browser, const CefRect& rect) {
  popupDip_ = {rect.x, rect.y, rect.width, rect.height};
  const float s = host_->deviceScale();
  host_->webLayer()->setPopup(popupVisible_,
                              {int(rect.x * s), int(rect.y * s), int(rect.width * s),
                               int(rect.height * s)});
}

void Client::OnImeCompositionRangeChanged(CefRefPtr<CefBrowser> browser, const CefRange& range,
                                          const RectList& characterBounds) {
  // La fenêtre de candidats de l'IME suit le dernier caractère composé.
  if (!characterBounds.empty()) host_->setImeRect(characterBounds.back());
}

void Client::OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type,
                     const RectList& dirty, const void* buffer, int width, int height) {
  WebFrame f;
  f.pixels = buffer;
  f.width = width;
  f.height = height;
  f.stride = width * 4;
  host_->onPaint();
  if (type == PET_VIEW) {
    host_->webLayer()->presentView(f);
  } else {
    host_->webLayer()->presentPopup(f);
  }
}

void Client::OnAcceleratedPaint(CefRefPtr<CefBrowser> browser, PaintElementType type,
                                const RectList& dirty, const CefAcceleratedPaintInfo& info) {
  WebFrame f;
#ifdef __APPLE__
  f.sharedHandle = info.shared_texture_io_surface;
#endif
  // La taille réelle de la texture vient de l'IOSurface ; à défaut, de la vue.
  f.width = info.extra.coded_size.width;
  f.height = info.extra.coded_size.height;
  if (f.width <= 0 || f.height <= 0) {
    int w = 0, h = 0;
    host_->viewSizePt(w, h);
    const float s = host_->deviceScale();
    f.width = int(w * s);
    f.height = int(h * s);
  }
  int64_t dirtyArea = 0;
  for (const auto& r : dirty) dirtyArea += int64_t(r.width) * r.height;
  f.dirtyPixels = dirtyArea;
  host_->onPaint();
  if (type == PET_VIEW) {
    host_->webLayer()->presentView(f);
  } else {
    host_->webLayer()->presentPopup(f);
  }
}

}  // namespace tentacle
