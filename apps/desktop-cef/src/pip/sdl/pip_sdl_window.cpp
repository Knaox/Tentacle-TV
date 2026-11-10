// La fenêtre PiP sur SDL3 : fabrication, modes, et la souris de SA page par un filtre
// d'évènements (chaîné au précédent) — la boucle de l'app ne voit jamais ses évènements.

#include <cmath>
#include <map>
#include <string>

#include "compositor/compositor.h"
#include "include/internal/cef_types.h"
#include "pip/sdl/pip_sdl_internal.h"

namespace tentacle::pip::sdl {
namespace {

uint32_t modifiers() {
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

class SdlPipWindow;
std::map<SDL_WindowID, SdlPipWindow*>& live() {
  static std::map<SDL_WindowID, SdlPipWindow*> windows;
  return windows;
}
SDL_EventFilter g_previous = nullptr;
void* g_previousData = nullptr;
bool g_installed = false;
bool SDLCALL filter(void* userdata, SDL_Event* e);

class SdlPipWindow final : public Window {
 public:
  SdlPipWindow(SDL_Window* host, const Options& o, const Box& box, Mode mode,
               const std::string& caption, PageInput input)
      : host_(host), input_(std::move(input)) {
    k_ = dipFactor(host);
    SDL_WindowFlags flags = SDL_WINDOW_BORDERLESS | SDL_WINDOW_UTILITY | SDL_WINDOW_RESIZABLE |
                            SDL_WINDOW_HIDDEN | SDL_WINDOW_HIGH_PIXEL_DENSITY;
    if (o.transparent) flags |= SDL_WINDOW_TRANSPARENT;
    window_ = SDL_CreateWindow(caption.c_str(), int(std::lround(box.width * k_)),
                               int(std::lround(box.height * k_)), flags);
    if (!window_) return;
    id_ = SDL_GetWindowID(window_);
    live()[id_] = this;
    if (!g_installed) {  // un seul filtre, chaîné au précédent
      SDL_GetEventFilter(&g_previous, &g_previousData);
      SDL_SetEventFilter(filter, nullptr);
      g_installed = true;
    }
    stack_ = o.makeStack ? o.makeStack(window_) : nullptr;
    applyMode(mode);
    setBounds(box);
    sync(false);
  }

  ~SdlPipWindow() override {
    live().erase(id_);
    stack_.reset();  // la page et la vidéo quittent la fenêtre AVANT elle
    if (window_) SDL_DestroyWindow(window_);
  }

  bool valid() const { return window_ && stack_; }

  Box bounds() override {
    int x = 0, y = 0, w = 0, h = 0;
    SDL_GetWindowPosition(window_, &x, &y);
    SDL_GetWindowSize(window_, &w, &h);
    return toDip({x, y, w, h}, k_);
  }

  void setBounds(const Box& b) override {
    ours_ = true;  // un changement de taille venu de nous, pas de la main
    SDL_SetWindowSize(window_, int(std::lround(b.width * k_)), int(std::lround(b.height * k_)));
    SDL_SetWindowPosition(window_, int(std::lround(b.x * k_)), int(std::lround(b.y * k_)));
    ours_ = false;
    sync(false);
  }

  void showInactive() override {
    SDL_SetHint(SDL_HINT_WINDOW_ACTIVATE_WHEN_SHOWN, "0");
    SDL_ShowWindow(window_);
    SDL_ResetHint(SDL_HINT_WINDOW_ACTIVATE_WHEN_SHOWN);
  }
  void hide() override { SDL_HideWindow(window_); }

  // Flottant : au-dessus de tout, sans propriétaire. Ancré : fenêtre POSSÉDÉE par la
  // principale (Windows : devant elle, réduite avec elle — `pipDocking.ts`).
  void applyMode(Mode mode) override {
    const bool floating = mode == Mode::floating;
    SDL_SetWindowParent(window_, floating ? nullptr : host_);
    SDL_SetWindowAlwaysOnTop(window_, floating);
  }

  void setCaption(const std::string& caption) override { SDL_SetWindowTitle(window_, caption.c_str()); }
  void setEvents(WindowEvents events) override { events_ = std::move(events); }
  bool focused() override { return (SDL_GetWindowFlags(window_) & SDL_WINDOW_INPUT_FOCUS) != 0; }
  Compositor* compositor() override { return stack_.get(); }
  double backingScale() override { return SDL_GetWindowDisplayScale(window_); }
  Box screenBounds() override { return displayBox(false); }
  Box screenWorkArea() override { return displayBox(true); }

  // Banc : un évènement SDL poussé dans la file — il traverse le filtre, comme un vrai.
  std::string inject(const std::string& kind, double x, double y, int clicks, double dy) override {
    SDL_Event e{};
    const float px = float(x * k_), py = float(y * k_);
    if (kind == "move" || kind == "drag") {
      e.type = SDL_EVENT_MOUSE_MOTION;
      e.motion.windowID = id_;
      e.motion.x = px, e.motion.y = py;
    } else if (kind == "down" || kind == "up") {
      e.type = kind == "up" ? SDL_EVENT_MOUSE_BUTTON_UP : SDL_EVENT_MOUSE_BUTTON_DOWN;
      e.button.windowID = id_;
      e.button.button = SDL_BUTTON_LEFT;
      e.button.down = kind == "down";
      e.button.clicks = Uint8(clicks);
      e.button.x = px, e.button.y = py;
    } else if (kind == "scroll") {
      e.type = SDL_EVENT_MOUSE_WHEEL;
      e.wheel.windowID = id_;
      e.wheel.y = float(dy / 40.0);
      e.wheel.mouse_x = px, e.wheel.mouse_y = py;
    } else {
      return "type inconnu : " + kind;
    }
    return SDL_PushEvent(&e) || !SDL_GetError()[0] ? "" : SDL_GetError();
  }
  std::string describe() override {
    const SDL_WindowFlags f = SDL_GetWindowFlags(window_);
    return std::string("sdl top=") + ((f & SDL_WINDOW_ALWAYS_ON_TOP) ? "1" : "0") +
           " parent=" + (SDL_GetWindowParent(window_) ? "1" : "0") + " title=" + SDL_GetWindowTitle(window_);
  }

  void setCursor(int type) {
    if (type == CT_NONE) return void(SDL_HideCursor());
    SDL_ShowCursor();
    auto& c = cursors_[type];
    if (!c) c = SDL_CreateSystemCursor(systemCursor(type));
    SDL_SetCursor(c);
  }

  /// Un évènement de SA fenêtre : à la page (souris), au PiP (taille), ou ignoré (clavier).
  void handle(const SDL_Event& e) {
    const double k = k_;
    switch (e.type) {
      case SDL_EVENT_MOUSE_MOTION:
        last_ = {e.motion.x / k, e.motion.y / k};
        if (input_.mouseMove) input_.mouseMove(last_.x, last_.y, modifiers(), false);
        break;
      case SDL_EVENT_WINDOW_MOUSE_LEAVE:
        if (input_.mouseMove) input_.mouseMove(last_.x, last_.y, modifiers(), true);
        break;
      case SDL_EVENT_MOUSE_BUTTON_DOWN:
      case SDL_EVENT_MOUSE_BUTTON_UP:
        if (input_.mouseButton) {
          input_.mouseButton(e.button.x / k, e.button.y / k, modifiers(), cefButton(e.button.button),
                             e.type == SDL_EVENT_MOUSE_BUTTON_UP, std::max<int>(1, e.button.clicks));
        }
        break;
      case SDL_EVENT_MOUSE_WHEEL:  // Chromium : 40 px par cran
        if (input_.wheel) {
          input_.wheel(e.wheel.mouse_x / k, e.wheel.mouse_y / k, modifiers(), -e.wheel.x * 40.0,
                       e.wheel.y * 40.0);
        }
        break;
      case SDL_EVENT_WINDOW_RESIZED:
      case SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED:
        sync(false);
        if (!ours_) userResized();
        break;
      case SDL_EVENT_WINDOW_DISPLAY_SCALE_CHANGED:
        k_ = dipFactor(host_);
        sync(true);
        break;
      case SDL_EVENT_WINDOW_CLOSE_REQUESTED:  // Alt+F4 : la page le voit fermé, comme Electron
        if (input_.closeRequested) input_.closeRequested();
        break;
      default:
        break;
    }
  }

  /// Un évènement de la fenêtre principale : le PiP ancré la suit.
  void hostEvent(const SDL_Event& e) {
    if ((e.type == SDL_EVENT_WINDOW_MOVED || e.type == SDL_EVENT_WINDOW_RESIZED) && events_.hostMoved) {
      events_.hostMoved();
    }
    if (e.type == SDL_EVENT_WINDOW_RESTORED && events_.hostRestored) events_.hostRestored();
  }

  SDL_WindowID hostId() const { return SDL_GetWindowID(host_); }

 private:
  Box displayBox(bool usable) {
    SDL_Rect r{};
    const SDL_DisplayID d = SDL_GetDisplayForWindow(window_);
    if (!(usable ? SDL_GetDisplayUsableBounds(d, &r) : SDL_GetDisplayBounds(d, &r))) return {};
    return toDip(r, k_);
  }

  // SDL ne prévient pas AVANT un redimensionnement par les bords : la garde (ratio, bornes,
  // coin ancré) s'applique juste APRÈS, et la taille choisie est retenue.
  void userResized() {
    if (events_.willResize) {
      const Box now = bounds();
      const Box guarded = events_.willResize(previous_, now);
      if (!(guarded == now)) setBounds(guarded);
    }
    if (events_.resizedByUser) events_.resizedByUser();
  }

  void sync(bool scaleChanged) {
    int w = 0, h = 0;
    SDL_GetWindowSize(window_, &w, &h);
    if (stack_) stack_->resize(w / k_, h / k_, SDL_GetWindowDisplayScale(window_));
    previous_ = bounds();
    if (input_.resized) input_.resized(scaleChanged);
  }

  SDL_Window* host_;
  SDL_Window* window_ = nullptr;
  SDL_WindowID id_ = 0;
  double k_ = 1;
  bool ours_ = false;
  Box previous_;
  Point last_;
  PageInput input_;
  WindowEvents events_;
  std::unique_ptr<Compositor> stack_;
  std::map<int, SDL_Cursor*> cursors_;
};

// L'identifiant de fenêtre d'un évènement qui en porte un (fenêtre, souris, clavier, texte),
// sinon 0 — les autres évènements n'ont pas ce champ.
SDL_WindowID windowOf(const SDL_Event& e) {
  if (e.type >= SDL_EVENT_WINDOW_FIRST && e.type <= SDL_EVENT_WINDOW_LAST) return e.window.windowID;
  switch (e.type) {
    case SDL_EVENT_MOUSE_MOTION: return e.motion.windowID;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_BUTTON_UP: return e.button.windowID;
    case SDL_EVENT_MOUSE_WHEEL: return e.wheel.windowID;
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_KEY_UP: return e.key.windowID;
    case SDL_EVENT_TEXT_INPUT: return e.text.windowID;
    case SDL_EVENT_TEXT_EDITING: return e.edit.windowID;
    default: return 0;
  }
}

bool SDLCALL filter(void*, SDL_Event* e) {
  const SDL_WindowID id = windowOf(*e);
  if (auto it = live().find(id); id != 0 && it != live().end()) {
    it->second->handle(*e);
    return false;  // pour la fenêtre PiP seulement : la boucle de l'app ne le voit pas
  }
  for (auto& [_, w] : live()) {
    if (id != 0 && w->hostId() == id) w->hostEvent(*e);
  }
  return g_previous ? g_previous(g_previousData, e) : true;
}

}  // namespace

std::unique_ptr<Window> createWindow(SDL_Window* host, const Options& options, const Box& box,
                                     Mode mode, const std::string& caption, PageInput input) {
  auto w = std::make_unique<SdlPipWindow>(host, options, box, mode, caption, std::move(input));
  if (!w->valid()) return nullptr;
  return w;
}

void setWindowCursor(Window& window, int type) { static_cast<SdlPipWindow&>(window).setCursor(type); }

}  // namespace tentacle::pip::sdl
