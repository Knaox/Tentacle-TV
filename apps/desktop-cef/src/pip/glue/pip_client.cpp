#include "pip/glue/pip_client.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

#include "compositor/compositor.h"

namespace tentacle::pip {
namespace {

CefRect dip(const Box& b) {
  return CefRect(int(std::lround(b.x)), int(std::lround(b.y)), int(std::lround(b.width)),
                 int(std::lround(b.height)));
}

CefMouseEvent mouse(double x, double y, uint32_t modifiers) {
  CefMouseEvent e;
  e.x = int(std::lround(x));
  e.y = int(std::lround(y));
  e.modifiers = modifiers;
  return e;
}

/// Le navigateur vu du contrôleur.
class BrowserPage final : public Page {
 public:
  explicit BrowserPage(CefRefPtr<CefBrowser> browser) : browser_(browser) {}
  void close() override { browser_->GetHost()->CloseBrowser(true); }
  void geometryChanged() override {
    browser_->GetHost()->NotifyScreenInfoChanged();
    browser_->GetHost()->WasResized();
  }

 private:
  CefRefPtr<CefBrowser> browser_;
};

/// La souris de la fenêtre PiP, vers SA page.
PageInput inputFor(CefRefPtr<CefBrowser> browser) {
  PageInput in;
  in.mouseMove = [browser](double x, double y, uint32_t m, bool leave) {
    browser->GetHost()->SendMouseMoveEvent(mouse(x, y, m), leave);
  };
  in.mouseButton = [browser](double x, double y, uint32_t m, int button, bool up, int clicks) {
    if (!up) browser->GetHost()->SetFocus(true);
    browser->GetHost()->SendMouseClickEvent(mouse(x, y, m),
                                            static_cast<cef_mouse_button_type_t>(button), up,
                                            std::max(1, clicks));
  };
  in.wheel = [browser](double x, double y, uint32_t m, double dx, double dy) {
    browser->GetHost()->SendMouseWheelEvent(mouse(x, y, m), int(std::lround(dx)),
                                            int(std::lround(dy)));
  };
  in.resized = [browser](bool scaleChanged) {
    if (scaleChanged) browser->GetHost()->NotifyScreenInfoChanged();
    browser->GetHost()->WasResized();
  };
  return in;
}

}  // namespace

bool PipClient::OnBeforePopup(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, int,
                              const CefString& targetUrl, const CefString&,
                              WindowOpenDisposition, bool, const CefPopupFeatures&,
                              CefWindowInfo&, CefRefPtr<CefClient>&, CefBrowserSettings&,
                              CefRefPtr<CefDictionaryValue>&, bool*) {
  std::fprintf(stderr, "[pip] popup du PiP refusée : %s\n", targetUrl.ToString().c_str());
  return true;
}

void PipClient::OnAfterCreated(CefRefPtr<CefBrowser> browser) {
  browser_ = browser;
  if (!controller_) {
    browser->GetHost()->CloseBrowser(true);
    return;
  }
  controller_->popupCreated(std::make_unique<BrowserPage>(browser), inputFor(browser));
}

bool PipClient::DoClose(CefRefPtr<CefBrowser>) {
  // Fermé par la page (`window.close()`) ou par nous : la vidéo revient d'abord.
  if (controller_) controller_->popupClosing();
  return false;
}

void PipClient::OnBeforeClose(CefRefPtr<CefBrowser>) {
  browser_ = nullptr;
  if (controller_) controller_->popupClosed();
}

void PipClient::GetViewRect(CefRefPtr<CefBrowser>, CefRect& rect) {
  const Size s = controller_ ? controller_->viewSize() : Size{1, 1};
  rect = CefRect(0, 0, std::max(1, int(std::lround(s.width))), std::max(1, int(std::lround(s.height))));
}

bool PipClient::GetScreenInfo(CefRefPtr<CefBrowser>, CefScreenInfo& info) {
  if (!controller_) return false;
  info.device_scale_factor = float(controller_->scale());
  // `window.screen` du PiP : l'écran où il est (la page y borne sa taille).
  info.rect = dip(controller_->screenBounds());
  info.available_rect = dip(controller_->screenWorkArea());
  info.depth = 24;
  info.depth_per_component = 8;
  return true;
}

bool PipClient::GetScreenPoint(CefRefPtr<CefBrowser>, int viewX, int viewY, int& screenX,
                               int& screenY) {
  if (!controller_) return false;
  const Point p = controller_->viewToScreen({double(viewX), double(viewY)});
  screenX = int(std::lround(p.x));
  screenY = int(std::lround(p.y));
  return true;
}

void PipClient::present(const WebFrame& frame, PaintElementType type) {
  Compositor* stack = controller_ ? controller_->compositor() : nullptr;
  if (!stack || type != PET_VIEW) return;  // pas de <select> dans le PiP
  stack->webLayer()->presentView(frame);
}

void PipClient::OnPaint(CefRefPtr<CefBrowser>, PaintElementType type, const RectList&,
                        const void* buffer, int width, int height) {
  WebFrame f;
  f.pixels = buffer;
  f.width = width;
  f.height = height;
  f.stride = width * 4;
  present(f, type);
}

void PipClient::OnAcceleratedPaint(CefRefPtr<CefBrowser>, PaintElementType type,
                                   const RectList& dirty, const CefAcceleratedPaintInfo& info) {
  WebFrame f;
#ifdef __APPLE__
  f.sharedHandle = info.shared_texture_io_surface;
#endif
  f.width = info.extra.coded_size.width;
  f.height = info.extra.coded_size.height;
  if ((f.width <= 0 || f.height <= 0) && controller_) {
    const Size s = controller_->viewSize();
    const double scale = controller_->scale();
    f.width = int(s.width * scale);
    f.height = int(s.height * scale);
  }
  int64_t area = 0;
  for (const auto& r : dirty) area += int64_t(r.width) * r.height;
  f.dirtyPixels = area;
  present(f, type);
}

bool PipClient::OnCursorChange(CefRefPtr<CefBrowser>, CefCursorHandle, cef_cursor_type_t type,
                               const CefCursorInfo&) {
  if (controller_) controller_->setCursor(int(type));
  return true;
}

bool PipClient::OnConsoleMessage(CefRefPtr<CefBrowser>, cef_log_severity_t,
                                 const CefString& message, const CefString& source, int line) {
  std::fprintf(stderr, "[pip-page] %s (%s:%d)\n", message.ToString().c_str(),
               source.ToString().c_str(), line);
  return false;
}

}  // namespace tentacle::pip
