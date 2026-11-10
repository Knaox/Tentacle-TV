#include "pip/glue/pip_install.h"

#include <chrono>
#include <cstdio>
#include <memory>
#include <thread>

#include <SDL3/SDL.h>

#include "app/app.h"
#include "include/cef_app.h"
#include "include/cef_request_context.h"
#include "pip/glue/pip_client.h"
#include "pip/glue/pip_commands.h"
#include "pip/pip_controller.h"
#include "pip/pip_platform.h"
#include "shell/client_popup.h"
#include "shell/ipc.h"

namespace tentacle::pip {
namespace {

/// Le bureau, avec un curseur remplaçable par les bancs (`pip.debug.cursor`).
class DebugDesktop final : public Desktop {
 public:
  explicit DebugDesktop(Desktop& real) : real_(real) {}
  std::optional<Point> cursorOverride;
  Point cursor() override { return cursorOverride.value_or(real_.cursor()); }
  Box workAreaNearest(Point p) override { return real_.workAreaNearest(p); }
  Box workAreaMatching(const Box& b) override { return real_.workAreaMatching(b); }
  Box displayBoundsMatching(const Box& b) override { return real_.displayBoundsMatching(b); }
  Box hostContentBounds() override { return real_.hostContentBounds(); }
  Box hostBounds() override { return real_.hostBounds(); }
  double bannerInset() override { return real_.bannerInset(); }
  bool reducedMotion() override { return real_.reducedMotion(); }

 private:
  Desktop& real_;
};

class DebugPlatform final : public Platform {
 public:
  explicit DebugPlatform(std::unique_ptr<Platform> real)
      : real_(std::move(real)), desktop_(real_->desktop()) {}
  DebugDesktop& debugDesktop() { return desktop_; }
  Desktop& desktop() override { return desktop_; }
  Ticker& ticker() override { return real_->ticker(); }
  std::unique_ptr<Window> createWindow(const Box& b, Mode m, const std::string& c,
                                       PageInput in) override {
    return real_->createWindow(b, m, c, std::move(in));
  }
  void setCursor(Window& w, int t) override { real_->setCursor(w, t); }
  void focusHost() override { real_->focusHost(); }

 private:
  std::unique_ptr<Platform> real_;
  DebugDesktop desktop_;
};

struct State {
  std::unique_ptr<DebugPlatform> platform;
  std::unique_ptr<Controller> controller;
  CefRefPtr<PipClient> client;  // le navigateur du PiP en cours (un seul à la fois)
  int popupHandler = 0, closingListener = 0;
};
std::unique_ptr<State> state;

Json boxJson(const Box& b) { return {b.x, b.y, b.width, b.height}; }

popup::Decision onPopup(const popup::Request& req, CefWindowInfo& windowInfo,
                        CefRefPtr<CefClient>& client, CefBrowserSettings& settings,
                        CefRefPtr<CefDictionaryValue>& extraInfo) {
  const OpenDecision d = state->controller->decide(req.frameName, req.url);
  if (d.kind == OpenDecision::Kind::notPip) return popup::Decision::pass;
  if (d.kind == OpenDecision::Kind::deny) return popup::Decision::deny;
  windowInfo.SetAsWindowless(kNullWindowHandle);
  windowInfo.shared_texture_enabled = true;  // IOSurface, comme la page principale
  windowInfo.external_begin_frame_enabled = false;  // horloge interne de CEF
  settings.background_color = CefColorSetARGB(0, 0, 0, 0);  // transparente : la vidéo dessous
  if (state->client) state->client->detach();
  state->client = new PipClient(state->controller.get());
  client = state->client;
  extraInfo = nullptr;  // ni __shell utile, ni window.tentacle : la page l'écrit d'ailleurs
  return popup::Decision::allow;
}

// La page ouvre le PiP après des appels asynchrones (`pip_open`, la sortie du plein écran) :
// le geste qui l'a demandé peut être consommé ou expiré, et Chromium bloque alors
// `window.open` AVANT `OnBeforePopup`. Electron n'a pas de bloqueur de popups : CEF non plus.
// Le schéma tentacle:// n'a pas de motif de réglage (mesuré : refusé, « bloquer » reste) —
// c'est donc la valeur par défaut du profil CEF ; le filtre des popups (`client_popup.h`) ne
// laisse passer que le PiP armé, comme le `setWindowOpenHandler` d'Electron.
void allowPopups() {
  auto context = CefRequestContext::GetGlobalContext();
  if (!context) return;
  context->SetContentSetting("", "", CEF_CONTENT_SETTING_TYPE_POPUPS, CEF_CONTENT_SETTING_VALUE_ALLOW);
  const auto now = context->GetContentSetting("", "", CEF_CONTENT_SETTING_TYPE_POPUPS);
  if (now != CEF_CONTENT_SETTING_VALUE_ALLOW) {
    std::fprintf(stderr, "[pip] bloqueur de popups encore actif (réglage %d)\n", int(now));
  }
}

void installDebug(const AppContext& ctx) {
  ipc::registerHandler("pip.debug.state", [](const Json&, ipc::Responder r) {
    if (!state) return r.reply(nullptr);
    Controller& c = *state->controller;
    Json out = {{"open", c.popupAlive()}, {"view", {c.viewSize().width, c.viewSize().height}},
                {"scale", c.scale()}, {"screen", boxJson(c.screenBounds())},
                {"workArea", boxJson(c.screenWorkArea())}};
    Desktop& desk = state->platform->desktop();
    out["host"] = boxJson(desk.hostContentBounds());
    out["hostWorkArea"] = boxJson(desk.workAreaMatching(desk.hostBounds()));
    out["mode"] = modeName(c.mode());
    out["videoLent"] = c.videoLent();
    if (const auto b = c.windowBounds()) out["bounds"] = boxJson(*b);
    if (Compositor* stack = c.compositor()) out["layers"] = stack->describeLayers();
    if (Window* w = c.window()) out["window"] = w->describe();
    r.reply(out);
  });
  if (!ctx.options || !ctx.options->extra.count("debug-input")) return;
  ipc::registerHandler("pip.debug.cursor", [](const Json& p, ipc::Responder r) {
    if (!state) return r.fail("no_pip", "PiP absent");
    auto& desk = state->platform->debugDesktop();
    if (p.is_object() && p.contains("x") && p.contains("y")) {
      desk.cursorOverride = Point{p["x"].get<double>(), p["y"].get<double>()};
    } else {
      desk.cursorOverride.reset();
    }
    r.reply(true);
  });
  // Un évènement de souris NATIF dans la fenêtre PiP : { kind, x, y, clicks?, dy? }.
  ipc::registerHandler("pip.debug.native", [](const Json& p, ipc::Responder r) {
    Window* w = state ? state->controller->window() : nullptr;
    if (!w) return r.fail("no_pip", "PiP absent");
    const std::string error = w->inject(p.value("kind", "move"), p.value("x", 0.0),
                                        p.value("y", 0.0), p.value("clicks", 1), p.value("dy", 0.0));
    if (!error.empty()) return r.fail("inject", error);
    r.reply(true);
  });
  // Déplace la fenêtre principale de { dx, dy } points (le PiP ancré la suit).
  SDL_Window* host = ctx.window;
  ipc::registerHandler("pip.debug.moveHost", [host](const Json& p, ipc::Responder r) {
    int x = 0, y = 0;
    SDL_GetWindowPosition(host, &x, &y);
    SDL_SetWindowPosition(host, x + p.value("dx", 0), y + p.value("dy", 0));
    r.reply(true);
  });
}

}  // namespace

void install(AppContext& ctx, bridge::Registry& registry) {
  auto real = createPlatform(ctx.window, ctx.nativeWindow, ctx.compositor);
  if (!real) {
    std::fprintf(stderr, "[pip] pas de PiP sur ce système : pip_* non déclarées\n");
    return;
  }
  state = std::make_unique<State>();
  state->platform = std::make_unique<DebugPlatform>(std::move(real));
  state->controller = std::make_unique<Controller>(*state->platform, ctx.compositor,
                                                   ctx.fakeVideo, currentFrame());
  registerCommands(registry, *state->controller);
  allowPopups();
  state->popupHandler = popup::addHandler(onPopup);
  state->closingListener = popup::addHostClosingListener([] {
    if (state) state->controller->hostClosing();
  });
  installDebug(ctx);
}

void shutdown() {
  if (!state) return;
  popup::removeHandler(state->popupHandler);
  popup::removeHostClosingListener(state->closingListener);
  // Le navigateur du PiP doit être parti avant CefShutdown : fermé, puis la pompe de CEF
  // tourne jusqu'à son OnBeforeClose (2 s au plus).
  state->controller->hostClosing();
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (state->controller->popupAlive() && std::chrono::steady_clock::now() < deadline) {
    CefDoMessageLoopWork();
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
  if (state->controller->popupAlive()) std::fprintf(stderr, "[pip] navigateur du PiP encore là\n");
  if (state->client) state->client->detach();
  state->controller.reset();
  state.reset();
}

}  // namespace tentacle::pip
