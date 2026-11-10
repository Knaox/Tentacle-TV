#include "shell/builtin_handlers.h"

#include <chrono>
#include <vector>

#include "shell/frame_wake.h"
#include "shell/ipc.h"
#include "shell/native_input.h"
#include "shell/shell.h"
#include "shell/stall_meter.h"
#include "shell/window_scale.h"

namespace tentacle {
namespace {

AppContext g_ctx;
Shell* g_shell = nullptr;
std::vector<std::function<void(const Json&)>> g_windowListeners;

Json windowState() {
  int w = 0, h = 0;
  windowSizeDip(g_ctx.window, w, h);  // DIP (shell/window_scale.h) : points sur macOS
  const SDL_DisplayMode* m = SDL_GetCurrentDisplayMode(SDL_GetDisplayForWindow(g_ctx.window));
  return {{"fullscreen", (SDL_GetWindowFlags(g_ctx.window) & SDL_WINDOW_FULLSCREEN) != 0},
          {"width", w},
          {"height", h},
          {"scale", windowScale(g_ctx.window).deviceScale},
          {"refreshRate", m ? m->refresh_rate : 0.0f}};
}

}  // namespace

void setBuiltinShell(Shell* shell) { g_shell = shell; }

void notifyWindowState() {
  if (!g_ctx.window) return;
  const Json state = windowState();
  ipc::emit("shell.window", state);
  for (auto& l : g_windowListeners) l(state);
}

void runWhenPageIdle(uint64_t quietMs, std::function<void()> task) {
  if (g_shell) g_shell->whenIdle(quietMs, std::move(task));
}

void addWindowStateListener(std::function<void(const Json&)> listener) {
  g_windowListeners.push_back(std::move(listener));
}

void registerBuiltinHandlers(AppContext& ctx) {
  g_ctx = ctx;
  // Témoin d'ordre : la page de test vérifie qu'il existe avant ses propres scripts.
  ipc::registerInjectedScript(
      "window.__socleInjected = 'avant la page, __shell=' + typeof window.__shell;");
  // KeyboardEvent.repeat : CEF macOS reconstruit un NSEvent « isARepeat:NO » pour chaque
  // touche hors écran et perd EVENTFLAG_IS_REPEAT ; le front s'en sert (Espace du PiP,
  // Entrée d'Octave, balayage). Un keydown d'une touche déjà enfoncée EST une répétition :
  // on le marque, à la capture sur window, avant tout écouteur de la page.
  ipc::registerInjectedScript(R"JS((() => {
  const down = new Set();
  let last = false;  // le keydown précédent était-il une répétition ? (pour son keypress)
  addEventListener('keydown', (e) => {
    last = down.has(e.code);
    if (last && !e.repeat) Object.defineProperty(e, 'repeat', { value: true });
    down.add(e.code);
  }, true);
  addEventListener('keypress', (e) => {
    if (last && !e.repeat) Object.defineProperty(e, 'repeat', { value: true });
  }, true);
  addEventListener('keyup', (e) => down.delete(e.code), true);
  addEventListener('blur', () => down.clear(), true);
})();)JS");
  // La page réveille l'horloge d'images en veille (frame_wake.h).
  ipc::registerInjectedScript(kFrameWakeScript);
  ipc::registerHandler("shell.wake", [](const Json&, ipc::Responder r) {
    if (g_shell) g_shell->nudgeFrameClock();
    r.reply(nullptr);
  });
  ipc::registerHandler("shell.ping", [](const Json& p, ipc::Responder r) {
    auto t = std::chrono::duration<double, std::milli>(
                 std::chrono::steady_clock::now().time_since_epoch())
                 .count();
    r.reply({{"echo", p}, {"t", t}});
  });
  ipc::registerHandler("shell.stats", [](const Json&, ipc::Responder r) {
    const auto s = g_ctx.compositor->stats();
    Json j = windowState();
    j["viewFrames"] = s.viewFrames;
    j["popupFrames"] = s.popupFrames;
    j["lastCopyMs"] = s.lastCopyMs;
    j["maxCopyMs"] = s.maxCopyMs;
    j["lastGpuCopyMs"] = s.lastGpuCopyMs;
    j["viewSizeChanges"] = s.viewSizeChanges;
    j["liveResizeFrames"] = s.liveResizeFrames;
    j["dirtyPixels"] = s.dirtyPixels;
    j["viewPixels"] = s.viewPixels;
    j["presentedFrames"] = s.presentedFrames;
    j["presentedFps"] = s.presentedFps;
    j["presentIntervalMeanMs"] = s.presentIntervalMeanMs;
    j["presentIntervalMaxMs"] = s.presentIntervalMaxMs;
    j["cursor"] = g_shell ? g_shell->lastCursor() : -1;
    r.reply(j);
  });
  // Les arrêts du fil principal (stall_meter.h) ; `{reset:true}` remet le compteur à zéro.
  ipc::registerHandler("shell.debug.stalls", [](const Json& p, ipc::Responder r) {
    stall::Meter& m = stall::meter();
    Json recent = Json::array();
    for (const auto& s : m.recent()) recent.push_back({{"what", s.what}, {"detail", s.detail}, {"ms", s.ms}});
    Json j{{"maxMs", m.maxMs()}, {"maxWhat", m.maxWhat()}, {"count", m.count()}, {"recent", recent}};
    if (p.is_object() && p.value("reset", false)) m.reset();
    r.reply(j);
  });
  ipc::registerHandler("shell.debug.webPixel", [](const Json& p, ipc::Responder r) {
    uint8_t px[4] = {0, 0, 0, 0};
    if (!g_ctx.compositor->webLayer()->samplePixel(p.value("x", 0), p.value("y", 0), px)) {
      r.fail("out_of_range", "pixel hors de l'image");
      return;
    }
    r.reply({{"b", px[0]}, {"g", px[1]}, {"r", px[2]}, {"a", px[3]}});
  });
  ipc::registerHandler("shell.debug.layers", [](const Json&, ipc::Responder r) {
    r.reply(g_ctx.compositor->describeLayers());
  });
  if (ctx.options->extra.count("debug-input")) {
    ipc::registerHandler("shell.debug.native", [](const Json& p, ipc::Responder r) {
      const std::string err = platform::injectNative(g_ctx.window, p);
      if (err.rfind("rect:", 0) == 0 || err.rfind("json:", 0) == 0) {
        r.reply(err.substr(5));
      } else if (err.empty()) {
        r.reply(true);
      } else {
        r.fail("inject", err);
      }
    });
  }
  ipc::registerHandler("shell.window.setFullscreen", [](const Json& p, ipc::Responder r) {
    SDL_SetWindowFullscreen(g_ctx.window, p.value("on", true));
    r.reply(windowState());
  });
  ipc::registerHandler("shell.window.state",
                       [](const Json&, ipc::Responder r) { r.reply(windowState()); });
  ipc::registerHandler("shell.quit", [](const Json&, ipc::Responder r) {
    r.reply();
    SDL_Event e{};
    e.type = SDL_EVENT_QUIT;
    SDL_PushEvent(&e);
  });
}

}  // namespace tentacle
