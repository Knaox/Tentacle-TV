#include "glue/pont_shell.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <memory>
#include <stdexcept>

#include "app/app.h"
#include "registry.h"
#include "shell/builtin_handlers.h"
#include "shell/ipc.h"
#include "glue/mpv_player_port.h"
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
  void preventDisplaySleep(bool on) override {
    // Multiplateforme : IOPMAssertion sous macOS, inhibiteur sous Linux, SetThreadExecutionState sous Windows.
    if (on) SDL_DisableScreenSaver();
    else SDL_EnableScreenSaver();
  }
  bool openExternal(const std::string& url) override { return SDL_OpenURL(url.c_str()); }

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
  state->video = std::make_unique<bridge::VideoChannels>(state->registry, *state->player);
  state->windowChannels = std::make_unique<bridge::WindowChannels>(state->registry, *state->window);
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

void installShim(AppContext& ctx) {
  bridge::ShimConfig config;
  const std::string origin = originOf(ctx.options->url);
  if (!origin.empty()) config.origins.push_back(origin);
  config.serverUrl = origin;
  config.version = "1.42.0";  // la version du front servi par le banc
#if defined(__APPLE__)
  config.platform = "darwin";
#elif defined(_WIN32)
  config.platform = "win32";
#else
  config.platform = "linux";
#endif
  config.titleBarHeight = 0;  // le socle garde la barre de titre standard
  ipc::registerInjectedScript(state->registry.injectedScript(bridge::embeddedShimSource(), config));
  std::fprintf(stderr, "[pont] window.tentacle pour %s : %zu commandes, %zu évènements\n",
               origin.empty() ? "(aucune origine)" : origin.c_str(), state->registry.commands().size(),
               state->registry.events().size());
}

void shutdown() { state.reset(); }

}  // namespace tentacle::pont
