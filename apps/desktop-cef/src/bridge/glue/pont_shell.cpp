#include "glue/pont_shell.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <memory>
#include <stdexcept>

#include "app/app.h"
#include "registry.h"
#include "shell/builtin_handlers.h"
#include "shell/external_url.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"
#include "glue/mpv_player_port.h"
#include "lifecycle/lifecycle.h"
#include "lifecycle/lifecycle_platform.h"
#include "glue/video_probe_glue.h"
#include "player/sound_policy.h"
#include "video_channels.h"
#include "window_channels.h"

namespace tentacle::pont {
namespace {

// IpcPort → plomberie du socle (`shell/ipc.h`).
class SocleIpc : public bridge::IpcPort {
 public:
  void registerHandler(const std::string& channel, bridge::Handler handler) override {
    ipc::registerHandler(channel, [handler](const Json& payload, ipc::Responder responder) {
      handler(payload, bridge::Reply{[responder](bridge::Json v) { responder.reply(std::move(v)); },
                                     [responder](std::string c, std::string m) { responder.fail(std::move(c), std::move(m)); }});
    });
  }
  void emit(const std::string& event, const bridge::Json& payload) override { ipc::emit(event, payload); }
};

// WindowPort → fenêtre SDL3 du socle.
class SdlWindow : public bridge::WindowPort {
 public:
  explicit SdlWindow(SDL_Window* w) : window_(w) {}
  bool isFullscreen() const override { return (SDL_GetWindowFlags(window_) & SDL_WINDOW_FULLSCREEN) != 0; }
  void setFullscreen(bool on) override { SDL_SetWindowFullscreen(window_, on); }
  // Le blocage d'Electron (`powerSave.ts`), idempotent et rendu à la sortie : IOPMAssertion
  // (macOS), PowerSetRequest (Windows), SDL + renfort logind (Linux) — src/lifecycle.
  void preventDisplaySleep(bool on) override { tentacle::lifecycle::preventDisplaySleep(on); }
  // Liste fermée d'Electron et mode banc : l'ouverture sûre de l'axe navigateur.
  bool openExternal(const std::string& url) override { return tentacle::openExternalSafely(url); }

 private:
  SDL_Window* window_;
};

struct State {
  SocleIpc ipc;
  bridge::Registry registry{ipc};
  std::unique_ptr<SdlWindow> window;
  std::unique_ptr<bridge::MpvPlayerPort> player;
  std::unique_ptr<bridge::VideoChannels> video;
  std::unique_ptr<bridge::WindowChannels> windowChannels;
};
std::unique_ptr<State> state;

/// `scheme://hôte:port` de l'URL chargée — la seule origine qui reçoit le pont.
std::string originOf(const std::string& url) {
  const auto scheme = url.find("://");
  if (scheme == std::string::npos) return {};
  const auto path = url.find('/', scheme + 3);
  return path == std::string::npos ? url : url.substr(0, path);
}

std::string extraOption(const AppContext& ctx, const char* key) {
  const auto it = ctx.options->extra.find(key);
  return it == ctx.options->extra.end() ? std::string() : it->second;
}

}  // namespace

void install(AppContext& ctx) {
  // `--mute` (bancs) : vaut `TENTACLE_MUTE=1` pour tout le processus, musique comprise — posé
  // avant la naissance de toute instance mpv (pont puis octave s'installent après).
  if (ctx.options && ctx.options->extra.count("mute")) tentacle::sound::forceMute();
  static const char* kModes[] = {"sortie native", "muet (ao=null, mute=yes)", "sonde (sortie native, échantillons à zéro)"};
  std::fprintf(stderr, "[pont] son : %s (%s)\n", kModes[static_cast<int>(tentacle::sound::mode())],
               tentacle::sound::nativeOutput());
  state = std::make_unique<State>();
  state->window = std::make_unique<SdlWindow>(ctx.window);
  state->player = std::make_unique<bridge::MpvPlayerPort>(ctx.window, ctx.nativeWindow, ctx.compositor, ctx.fakeVideo);
  state->video = std::make_unique<bridge::VideoChannels>(
      state->registry, *state->player, bridge::VideoChannels::Clock{},
      [](int ms, std::function<void()> task) { postToMainDelayed(std::move(task), ms); });
  state->windowChannels = std::make_unique<bridge::WindowChannels>(state->registry, *state->window);
#ifdef TENTACLE_VIDEO_PROBES
  // Sonde de surface du panneau de dev (Electron : macOS hors paquet livré).
  installVideoProbes(state->registry, ctx.nativeWindow, [] { return state ? state->player->surfaceState() : Json(nullptr); });
#endif
  // Diagnostic HORS `window.tentacle` (canal du socle, préfixe `pont.`) : preuve HDR sans capture.
  ipc::registerHandler("pont.debug.surface", [](const Json&, ipc::Responder r) {
    r.reply(state ? state->player->surfaceState() : Json(nullptr));
  });
  addWindowStateListener([](const Json& s) {
    if (!state) return;
    state->windowChannels->fullscreenChanged(s.value("fullscreen", false));
    state->player->windowResized(s.value("width", 0.0), s.value("height", 0.0));
  });
}

bridge::Registry& registry() {
  if (!state) throw std::logic_error("pont non installé");
  return state->registry;
}

void setOnVideoClaim(std::function<void()> claim) {
  if (state) state->video->setOnVideoClaim(std::move(claim));
}

void setVideoPropertyObserver(std::function<void(const std::string&, const nlohmann::json&)> observer) {
  if (state) state->video->setPropertyObserver(std::move(observer));
}

void installShim(AppContext& ctx) {
  bridge::ShimConfig config;
  const std::string origin = originOf(ctx.options->url);
  if (!origin.empty()) config.origins.push_back(origin);
  // Adresse du serveur que le front reçoit s'il n'en a aucune : --server-url, sinon l'origine
  // de la page quand c'est le serveur qui la sert. Sous tentacle://app (front embarqué, profil
  // d'Electron), c'est le stockage qui la porte : rien n'est imposé sans --server-url.
  config.serverUrl = extraOption(ctx, "server-url");
  const bool servedByServer = origin.rfind("http://", 0) == 0 || origin.rfind("https://", 0) == 0;
  if (config.serverUrl.empty() && servedByServer) config.serverUrl = origin;
  config.version = extraOption(ctx, "app-version");
  if (config.version.empty()) config.version = "1.42.0";  // la version du front servi par le banc
#if defined(__APPLE__)
  config.platform = "darwin";
#elif defined(_WIN32)
  config.platform = "win32";
#else
  config.platform = "linux";
#endif
  // La bande d'hôte que la page dessine (`macosTitleBar.ts` : 38 sur macOS, 0 ailleurs) et le
  // focus de la fenêtre (macOS) : le cadre est celui d'Electron (src/lifecycle, axe systeme).
  config.titleBarHeight = tentacle::lifecycle::platform::titleBarHeight();
  config.windowFocus = tentacle::lifecycle::platform::hasWindowFocusBridge();
  ipc::registerInjectedScript(state->registry.injectedScript(bridge::embeddedShimSource(), config));
  std::fprintf(stderr, "[pont] window.tentacle pour %s : %zu commandes, %zu évènements\n",
               origin.empty() ? "(aucune origine)" : origin.c_str(), state->registry.commands().size(),
               state->registry.events().size());
}

void shutdown() { state.reset(); }

bool videoRunning() { return state && state->player && state->player->running(); }

void stopVideo(std::function<void()> done) {
  if (!videoRunning()) return done();
  state->player->stop(std::move(done));
}

void pauseVideo() {
  if (!videoRunning()) return;
  state->player->setProperty("pause", true, [](std::optional<std::string>) {});
}

}  // namespace tentacle::pont
