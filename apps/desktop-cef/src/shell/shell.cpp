#include "shell/shell.h"

#include <algorithm>
#include <cstdio>

#include "shell/app_menu.h"
#include "shell/frame_clock.h"
#include "shell/ipc.h"
#include "shell/ipc_protocol.h"
#include "shell/navigation_rule.h"

namespace tentacle {
namespace {

// Rien de peint ni de saisi depuis ces délais : l'horloge d'images ralentit, puis s'endort
// (shell/frame_clock.h).
constexpr uint64_t kFrameClockIdleAfterMs = 250;
constexpr uint64_t kFrameClockDeepIdleAfterMs = 3000;

SDL_SystemCursor systemCursor(cef_cursor_type_t t) {
  switch (t) {
    case CT_CROSS: return SDL_SYSTEM_CURSOR_CROSSHAIR;
    case CT_HAND: return SDL_SYSTEM_CURSOR_POINTER;
    case CT_IBEAM:
    case CT_VERTICALTEXT: return SDL_SYSTEM_CURSOR_TEXT;
    case CT_WAIT: return SDL_SYSTEM_CURSOR_WAIT;
    case CT_PROGRESS: return SDL_SYSTEM_CURSOR_PROGRESS;
    case CT_EASTRESIZE:
    case CT_WESTRESIZE:
    case CT_EASTWESTRESIZE:
    case CT_COLUMNRESIZE: return SDL_SYSTEM_CURSOR_EW_RESIZE;
    case CT_NORTHRESIZE:
    case CT_SOUTHRESIZE:
    case CT_NORTHSOUTHRESIZE:
    case CT_ROWRESIZE: return SDL_SYSTEM_CURSOR_NS_RESIZE;
    case CT_NORTHEASTRESIZE:
    case CT_SOUTHWESTRESIZE:
    case CT_NORTHEASTSOUTHWESTRESIZE: return SDL_SYSTEM_CURSOR_NESW_RESIZE;
    case CT_NORTHWESTRESIZE:
    case CT_SOUTHEASTRESIZE:
    case CT_NORTHWESTSOUTHEASTRESIZE: return SDL_SYSTEM_CURSOR_NWSE_RESIZE;
    case CT_MOVE: return SDL_SYSTEM_CURSOR_MOVE;
    case CT_NOTALLOWED:
    case CT_NODROP: return SDL_SYSTEM_CURSOR_NOT_ALLOWED;
    default: return SDL_SYSTEM_CURSOR_DEFAULT;
  }
}

}  // namespace

Shell::Shell(SDL_Window* window, Compositor* compositor, ShellOptions options)
    : window_(window), compositor_(compositor), options_(std::move(options)) {
  client_ = new Client(this);
  dialogs_ = new BrowserDialogs(window_);
  syncWindowGeometry();
  platform::installAppMenu([this](platform::EditCommand c) {
    if (!browser_) return;
    auto frame = browser_->GetFocusedFrame();
    if (!frame) frame = browser_->GetMainFrame();
    using C = platform::EditCommand;
    switch (c) {
      case C::Undo: frame->Undo(); break;
      case C::Redo: frame->Redo(); break;
      case C::Cut: frame->Cut(); break;
      case C::Copy: frame->Copy(); break;
      case C::Paste: frame->Paste(); break;
      case C::PasteAndMatchStyle: frame->PasteAndMatchStyle(); break;
      case C::Delete: frame->Delete(); break;
      case C::SelectAll: frame->SelectAll(); break;
    }
  });
}

Shell::~Shell() {
  dialogs_->detach();
  platform::uninstallNativeWheel();
  platform::stopFrameClock();
  for (auto& [_, c] : cursors_) SDL_DestroyCursor(c);
}

bool Shell::start() {
  nav::setAppOrigin(options_.url);  // navigateur : l'origine que le cadre principal garde
  CefWindowInfo wi;
  wi.SetAsWindowless(kNullWindowHandle);
  wi.shared_texture_enabled = true;  // IOSurface (macOS) : zéro copie CPU
  wi.external_begin_frame_enabled = platform::frameClockSupported();  // vsync (frame_clock.h)
  CefBrowserSettings bs;
  bs.windowless_frame_rate = options_.frameRate;
  bs.background_color = CefColorSetARGB(0, 0, 0, 0);  // transparente : la vidéo dessous

  auto scripts = CefListValue::Create();
  const auto& js = ipc::injectedScripts();
  for (size_t i = 0; i < js.size(); ++i) scripts->SetString(i, js[i]);
  auto extra = CefDictionaryValue::Create();
  extra->SetList(ipc::proto::kExtraScripts, scripts);

  input_.setNativeWheel(platform::installNativeWheel(
      window_, [this](const platform::NativeWheel& w) {
        wakeFrameClock();
        input_.wheel(w, browser_);
      }));
  return CefBrowserHost::CreateBrowser(wi, client_, options_.url, bs, extra, nullptr);
}

void Shell::handleEvent(const SDL_Event& e) {
  switch (e.type) {
    case SDL_EVENT_WINDOW_RESIZED:
    case SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED:
    case SDL_EVENT_WINDOW_DISPLAY_SCALE_CHANGED:
    case SDL_EVENT_WINDOW_DISPLAY_CHANGED:
      syncWindowGeometry();
      syncFrameRate();
      break;
    case SDL_EVENT_WINDOW_ENTER_FULLSCREEN:
    case SDL_EVENT_WINDOW_LEAVE_FULLSCREEN:
      syncWindowGeometry();
      break;
    case SDL_EVENT_WINDOW_MINIMIZED:
      if (browser_) browser_->GetHost()->WasHidden(true);
      break;
    case SDL_EVENT_WINDOW_RESTORED:
      if (browser_) browser_->GetHost()->WasHidden(false);
      break;
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_KEY_UP:
      wakeFrameClock();
      if (!interceptKey(e.key)) input_.handle(e, browser_);
      break;
    default:
      if (e.type >= SDL_EVENT_KEY_DOWN && e.type < SDL_EVENT_JOYSTICK_AXIS_MOTION) wakeFrameClock();
      input_.handle(e, browser_);
      break;
  }
}

void Shell::syncWindowGeometry() {
  int w = 0, h = 0;
  SDL_GetWindowSize(window_, &w, &h);
  float scale = SDL_GetWindowPixelDensity(window_);
  if (scale <= 0) scale = 1.0f;
  const bool sizeChanged = w != widthPt_ || h != heightPt_;
  const bool scaleChanged = scale != scale_;
  if (!sizeChanged && !scaleChanged) return;
  widthPt_ = w;
  heightPt_ = h;
  scale_ = scale;
  compositor_->resize(w, h, scale);
  wakeFrameClock();
  if (!browser_) return;
  if (scaleChanged) browser_->GetHost()->NotifyScreenInfoChanged();
  browser_->GetHost()->WasResized();
}

void Shell::requestClose() {
  if (browser_) {
    browser_->GetHost()->CloseBrowser(true);
  } else {
    closed_ = true;
  }
}

void Shell::viewSizePt(int& width, int& height) {
  width = widthPt_;
  height = heightPt_;
}

void Shell::viewToScreen(int x, int y, int& sx, int& sy) {
  int wx = 0, wy = 0;
  SDL_GetWindowPosition(window_, &wx, &wy);
  sx = wx + x;
  sy = wy + y;
}

void Shell::syncFrameRate() {
  // Écran changé (60 Hz externe ↔ 120 Hz interne) : CEF suit la fréquence du nouvel écran.
  if (!browser_ || options_.fixedFrameRate) return;
  const SDL_DisplayMode* m = SDL_GetCurrentDisplayMode(SDL_GetDisplayForWindow(window_));
  if (!m || m->refresh_rate <= 1) return;
  auto host = browser_->GetHost();
  const int want = int(m->refresh_rate + 0.5f), have = host->GetWindowlessFrameRate();
  if (want == have) return;
  host->SetWindowlessFrameRate(want);
  std::fprintf(stderr, "[shell] fréquence CEF %d → %d Hz (relue %d)\n", have, want,
               host->GetWindowlessFrameRate());
}

void Shell::setImeRect(const CefRect& r) {
  SDL_Rect area{r.x, r.y, std::max(r.width, 1), std::max(r.height, 1)};
  SDL_SetTextInputArea(window_, &area, 0);
}

void Shell::setCursor(cef_cursor_type_t type) {
  lastCursor_ = int(type);
  if (type == CT_NONE) {
    SDL_HideCursor();
    cursorHidden_ = true;
    return;
  }
  if (cursorHidden_) {
    SDL_ShowCursor();
    cursorHidden_ = false;
  }
  const SDL_SystemCursor sc = systemCursor(type);
  auto& c = cursors_[int(sc)];
  if (!c) c = SDL_CreateSystemCursor(sc);
  SDL_SetCursor(c);
}

void Shell::setTitle(const std::string& title) {
  SDL_SetWindowTitle(window_, title.empty() ? "Tentacle" : title.c_str());
}

void Shell::onBrowserCreated(CefRefPtr<CefBrowser> browser) {
  browser_ = browser;
  platform::setPageReceivesShortcuts(true);
  browser_->GetHost()->SetFocus(true);
  browser_->GetHost()->WasResized();
  platform::startFrameClock(window_, [this] { onFrameTick(); });
}

void Shell::onFrameTick() {
  if (!browser_) return;
  browser_->GetHost()->SendExternalBeginFrame();
  const uint64_t quiet = SDL_GetTicks() - lastActivityMs_;
  const auto mode = quiet >= kFrameClockDeepIdleAfterMs ? platform::FrameClockMode::deepIdle
                    : quiet >= kFrameClockIdleAfterMs   ? platform::FrameClockMode::idle
                                                        : platform::FrameClockMode::full;
  if (mode != clockMode_) {
    clockMode_ = mode;
    platform::setFrameClockMode(mode);
    if (mode == platform::FrameClockMode::deepIdle) compositor_->webLayer()->trim();
  }
}

void Shell::nudgeFrameClock() {
  // Mesuré : le front met à jour le DOM plusieurs fois par seconde pendant une lecture sans
  // rien peindre ; relancer le délai gardait l'horloge à 120 Hz pour rien. Ici le lien repart,
  // le tick suivant envoie le BeginFrame, puis recalcule le mode depuis la dernière activité.
  if (clockMode_ == platform::FrameClockMode::full) return;
  clockMode_ = platform::FrameClockMode::full;
  platform::setFrameClockMode(clockMode_);
}

void Shell::wakeFrameClock() {
  lastActivityMs_ = SDL_GetTicks();
  if (clockMode_ == platform::FrameClockMode::full) return;
  clockMode_ = platform::FrameClockMode::full;
  platform::setFrameClockMode(clockMode_);
}

void Shell::onBrowserClosed() {
  dialogs_->detach();
  platform::stopFrameClock();
  platform::setPageReceivesShortcuts(false);
  browser_ = nullptr;
  closed_ = true;
}

}  // namespace tentacle
