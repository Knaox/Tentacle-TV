#include "shell/shell.h"

#include <cstdlib>

#include <algorithm>
#include <cmath>
#include <cstdio>

#include "app/platform_app.h"
#include "shell/app_menu.h"
#include "shell/frame_clock.h"
#include "shell/ipc.h"
#include "shell/ipc_protocol.h"
#include "shell/external_url.h"
#include "shell/navigation_rule.h"
#include "shell/zoom_guard.h"
#include "shell/window_scale.h"

namespace tentacle {
namespace {

// Rien de peint ni de saisi depuis ces délais : l'horloge d'images ralentit, puis s'endort
// (shell/frame_clock.h).
constexpr uint64_t kFrameClockIdleAfterMs = 250;
constexpr uint64_t kFrameClockDeepIdleAfterMs = 3000;

}  // namespace

Shell::Shell(SDL_Window* window, Compositor* compositor, ShellOptions options)
    : window_(window), compositor_(compositor), options_(std::move(options)) {
  client_ = new Client(this);
  dialogs_ = new BrowserDialogs(window_);
  dragDrop_ = std::make_unique<DragDrop>(window_);
  tooltip_ = std::make_unique<TooltipController>(window_);
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
}

bool Shell::start() {
  nav::setAppOrigin(options_.url);  // navigateur : l'origine que le cadre principal garde
  nav::installPopupPolicy();         // navigateur : window.open, target=_blank (Electron)
  CefWindowInfo wi;
#if defined(_WIN32)
  // Windows : la fenêtre hôte désigne l'écran (DPI, window.screen) et sert de parente aux
  // dialogues que CEF ouvre lui-même ; sans elle, l'écran principal et des dialogues orphelins.
  wi.SetAsWindowless(static_cast<CefWindowHandle>(platform::nativeWindow(window_)));
#else
  wi.SetAsWindowless(kNullWindowHandle);
#endif
  // IOSurface (macOS), dmabuf (Linux), D3D11 (Windows) : zéro copie CPU. Repli de diagnostic :
  // TENTACLE_NO_SHARED_TEXTURE=1 → OnPaint (pilote dont l'import dmabuf échouerait, Linux).
  wi.shared_texture_enabled = std::getenv("TENTACLE_NO_SHARED_TEXTURE") == nullptr;
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
  // navigateur : la bulle suit la souris et part au premier geste ; puis une session de
  // glisser interne en cours, ou un dépôt venu de l'OS, prend l'évènement.
  tooltip_->onEvent(e);
  guardZoom(e, browser_);
  const bool dragging = dragDrop_->internalActive();
  if (dragDrop_->handleEvent(e, browser_)) {
    if (e.type == SDL_EVENT_MOUSE_BUTTON_UP) input_.noteButtonUp(e.button.button);
    // Fin du glisser : la page retrouve son curseur.
    if (dragging && !dragDrop_->internalActive() && pageCursor_) applyCursor(pageCursor_);
    wakeFrameClock();
    return;
  }
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
  // En DIP (shell/window_scale.h) : identique sur macOS, ramené de pixels sous Windows/X11.
  int w = 0, h = 0;
  windowSizeDip(window_, w, h);
  const WindowScale ws = windowScale(window_);
  const float scale = ws.deviceScale;
  windowToDip_ = ws.windowToDip;
  input_.setWindowToDip(windowToDip_);
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
  sx = wx + int(std::lround(x / windowToDip_));
  sy = wy + int(std::lround(y / windowToDip_));
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
  const float k = 1.0f / windowToDip_;  // DIP → unités de fenêtre SDL
  SDL_Rect area{int(std::lround(r.x * k)), int(std::lround(r.y * k)), std::max(int(std::lround(r.width * k)), 1),
                std::max(int(std::lround(r.height * k)), 1)};
  SDL_SetTextInputArea(window_, &area, 0);
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
  tooltip_->setText("");
  dialogs_->detach();
  platform::stopFrameClock();
  platform::setPageReceivesShortcuts(false);
  browser_ = nullptr;
  closed_ = true;
}

}  // namespace tentacle
