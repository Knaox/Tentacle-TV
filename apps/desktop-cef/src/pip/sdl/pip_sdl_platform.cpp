// Le PiP sur SDL3 : le bureau (écrans, curseur, fenêtre principale), la minuterie, la fabrique.

#include <cmath>
#include <limits>

#include "include/internal/cef_types.h"
#include "pip/sdl/pip_sdl_internal.h"
#include "shell/main_thread.h"

namespace tentacle::pip::sdl {

double dipFactor(SDL_Window* window) {
  const float density = SDL_GetWindowPixelDensity(window);
  const float scale = SDL_GetWindowDisplayScale(window);
  return density > 0 && scale > 0 ? double(scale) / density : 1.0;
}

SDL_SystemCursor systemCursor(int t) {
  switch (t) {
    case CT_CROSS: return SDL_SYSTEM_CURSOR_CROSSHAIR;
    case CT_HAND: return SDL_SYSTEM_CURSOR_POINTER;
    case CT_IBEAM: return SDL_SYSTEM_CURSOR_TEXT;
    case CT_EASTRESIZE:
    case CT_WESTRESIZE:
    case CT_EASTWESTRESIZE: return SDL_SYSTEM_CURSOR_EW_RESIZE;
    case CT_NORTHRESIZE:
    case CT_SOUTHRESIZE:
    case CT_NORTHSOUTHRESIZE: return SDL_SYSTEM_CURSOR_NS_RESIZE;
    case CT_NORTHEASTRESIZE:
    case CT_SOUTHWESTRESIZE:
    case CT_NORTHEASTSOUTHWESTRESIZE: return SDL_SYSTEM_CURSOR_NESW_RESIZE;
    case CT_NORTHWESTRESIZE:
    case CT_SOUTHEASTRESIZE:
    case CT_NORTHWESTSOUTHEASTRESIZE: return SDL_SYSTEM_CURSOR_NWSE_RESIZE;
    case CT_MOVE:
    case CT_GRABBING: return SDL_SYSTEM_CURSOR_MOVE;
    case CT_NOTALLOWED:
    case CT_NODROP: return SDL_SYSTEM_CURSOR_NOT_ALLOWED;
    default: return SDL_SYSTEM_CURSOR_DEFAULT;
  }
}

uint32_t cefModifiers() {
  const SDL_Keymod k = SDL_GetModState();
  uint32_t m = 0;
  if (k & SDL_KMOD_SHIFT) m |= EVENTFLAG_SHIFT_DOWN;
  if (k & SDL_KMOD_CTRL) m |= EVENTFLAG_CONTROL_DOWN;
  if (k & SDL_KMOD_ALT) m |= EVENTFLAG_ALT_DOWN;
  if (k & SDL_KMOD_GUI) m |= EVENTFLAG_COMMAND_DOWN;
  const SDL_MouseButtonFlags b = SDL_GetMouseState(nullptr, nullptr);
  if (b & SDL_BUTTON_LMASK) m |= EVENTFLAG_LEFT_MOUSE_BUTTON;
  if (b & SDL_BUTTON_MMASK) m |= EVENTFLAG_MIDDLE_MOUSE_BUTTON;
  if (b & SDL_BUTTON_RMASK) m |= EVENTFLAG_RIGHT_MOUSE_BUTTON;
  return m;
}

int cefButton(uint8_t b) {
  return b == SDL_BUTTON_RIGHT ? MBT_RIGHT : b == SDL_BUTTON_MIDDLE ? MBT_MIDDLE : MBT_LEFT;
}

SDL_Window* createNativeWindow(SDL_Window* host, const Options& o, bool popup,
                               const std::string& caption, int width, int height) {
  SDL_WindowFlags flags = SDL_WINDOW_HIDDEN | SDL_WINDOW_HIGH_PIXEL_DENSITY;
  if (o.transparent) flags |= SDL_WINDOW_TRANSPARENT;
  if (popup) {
    // Ni prise du pointeur (SDL ne demande jamais xdg_popup.grab : rien ne la referme au
    // premier clic ailleurs) ni clavier, dont la page du PiP ne se sert pas.
    return SDL_CreatePopupWindow(host, 0, 0, width, height,
                                 flags | SDL_WINDOW_POPUP_MENU | SDL_WINDOW_NOT_FOCUSABLE);
  }
  flags |= SDL_WINDOW_BORDERLESS | SDL_WINDOW_UTILITY | SDL_WINDOW_RESIZABLE;
  return SDL_CreateWindow(caption.c_str(), width, height, flags);
}

SDL_Point positionOrigin(SDL_Window* host, bool popup) {
  SDL_Point p{0, 0};
  if (popup) SDL_GetWindowPosition(host, &p.x, &p.y);
  return p;
}

namespace {

/// Une minuterie répétée sur le fil principal (postToMainDelayed), arrêtable pendant un tour.
class MainTicker final : public Ticker {
 public:
  std::function<void()> every(double intervalMs, std::function<void()> tick) override {
    auto alive = std::make_shared<bool>(true);
    auto loop = std::make_shared<std::function<void()>>();
    *loop = [alive, tick = std::move(tick), loop, intervalMs]() {
      if (!*alive) return;
      tick();
      if (*alive) postToMainDelayed(*loop, int64_t(intervalMs));
    };
    postToMainDelayed(*loop, int64_t(intervalMs));
    // `loop` se tient lui-même : l'arrêt le libère.
    return [alive, loop] {
      *alive = false;
      postToMain([loop] { *loop = nullptr; });
    };
  }
  double nowMs() override { return SDL_GetTicksNS() / 1e6; }
};

class SdlDesktop final : public Desktop {
 public:
  SdlDesktop(SDL_Window* host, std::function<bool()> reduced) : host_(host), reduced_(std::move(reduced)) {}

  Point cursor() override {
    float x = 0, y = 0;
    SDL_GetGlobalMouseState(&x, &y);
    const double k = dipFactor(host_);
    return {x / k, y / k};
  }
  Box workAreaNearest(Point p) override { return area(nearest(p), true); }
  Box workAreaMatching(const Box& b) override { return area(matching(b), true); }
  Box displayBoundsMatching(const Box& b) override { return area(matching(b), false); }
  Box hostContentBounds() override {
    int x = 0, y = 0, w = 0, h = 0;
    SDL_GetWindowPosition(host_, &x, &y);
    SDL_GetWindowSize(host_, &w, &h);
    return toDip({x, y, w, h}, dipFactor(host_));
  }
  Box hostBounds() override {
    int top = 0, left = 0, bottom = 0, right = 0;
    SDL_GetWindowBordersSize(host_, &top, &left, &bottom, &right);
    const double k = dipFactor(host_);
    Box b = hostContentBounds();
    return {b.x - left / k, b.y - top / k, b.width + (left + right) / k, b.height + (top + bottom) / k};
  }
  double bannerInset() override { return 0; }  // la barre intégrée n'existe que sous macOS
  bool reducedMotion() override { return reduced_ && reduced_(); }

 private:
  Box area(SDL_DisplayID d, bool usable) {
    SDL_Rect r{};
    if (!(usable ? SDL_GetDisplayUsableBounds(d, &r) : SDL_GetDisplayBounds(d, &r))) return {};
    return toDip(r, dipFactor(host_));
  }
  SDL_DisplayID nearest(Point p) {
    const double k = dipFactor(host_);
    const SDL_Point px{int(std::lround(p.x * k)), int(std::lround(p.y * k))};
    const SDL_DisplayID d = SDL_GetDisplayForPoint(&px);
    return d ? d : SDL_GetDisplayForWindow(host_);
  }
  SDL_DisplayID matching(const Box& b) {
    const double k = dipFactor(host_);
    const SDL_Rect px{int(std::lround(b.x * k)), int(std::lround(b.y * k)),
                      int(std::lround(b.width * k)), int(std::lround(b.height * k))};
    const SDL_DisplayID d = SDL_GetDisplayForRect(&px);
    return d ? d : SDL_GetDisplayForWindow(host_);
  }

  SDL_Window* host_;
  std::function<bool()> reduced_;
};

class SdlPlatform final : public Platform {
 public:
  SdlPlatform(SDL_Window* host, Options options)
      : host_(host), options_(std::move(options)), desktop_(host, options_.reducedMotion) {}
  Desktop& desktop() override { return desktop_; }
  Ticker& ticker() override { return ticker_; }
  std::unique_ptr<Window> createWindow(const Box& box, Mode mode, const std::string& caption,
                                       PageInput input) override {
    return sdl::createWindow(host_, options_, box, mode, caption, std::move(input));
  }
  void setCursor(Window& window, int type) override { setWindowCursor(window, type); }
  void focusHost() override {
    if (options_.focusHost) options_.focusHost();
  }

 private:
  SDL_Window* host_;
  Options options_;
  SdlDesktop desktop_;
  MainTicker ticker_;
};

}  // namespace

std::unique_ptr<Platform> createPlatform(SDL_Window* host, Options options) {
  if (!host || !options.makeStack) return nullptr;
  return std::make_unique<SdlPlatform>(host, std::move(options));
}

}  // namespace tentacle::pip::sdl
