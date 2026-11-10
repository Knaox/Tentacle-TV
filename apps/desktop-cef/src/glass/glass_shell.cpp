#include "glass/glass_shell.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <map>
#include <memory>

#include "app/app.h"
#include "glass/glass_platform.h"
#include "glass/glass_sampler.h"
#include "glass/regions.h"
#include "glass/validate.h"
#include "glue/pont_shell.h"
#include "lifecycle/lifecycle.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle::glass {
namespace {

/// Les minuteurs du gestionnaire, sur le fil principal ; un minuteur effacé ne part plus.
class MainTimers final : public Timers {
 public:
  TimerId set(std::function<void()> callback, double ms) override {
    const TimerId id = ++next_;
    pending_[id] = std::move(callback);
    std::weak_ptr<int> alive = alive_;
    postToMainDelayed([this, id, alive] {
      if (!alive.lock()) return;
      const auto it = pending_.find(id);
      if (it == pending_.end()) return;
      auto callback = std::move(it->second);
      pending_.erase(it);
      callback();
    }, static_cast<int64_t>(ms < 0 ? 0 : ms));
    return id;
  }
  void clear(TimerId timer) override { pending_.erase(timer); }

 private:
  std::map<TimerId, std::function<void()>> pending_;
  TimerId next_ = 0;
  std::shared_ptr<int> alive_ = std::make_shared<int>(0);
};

struct State {
  void* nativeWindow = nullptr;
  Availability availability = Availability::NotMacos;
  bool refractsVideo = false;
  std::unique_ptr<GlassBackend> backend;
  MainTimers timers;
  std::unique_ptr<GlassRegions> regions;
  std::unique_ptr<GlassSampler> sampler;
  int64_t lastComplaintMs = -60'000;
};
std::unique_ptr<State> state;

/// Un lot illisible ou une région écartée se dit — une fois par minute au plus.
void complain(const std::string& message) {
  using namespace std::chrono;
  const int64_t now = duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count();
  if (now - state->lastComplaintMs < 60'000) return;
  state->lastComplaintMs = now;
  std::fprintf(stderr, "[liquid-glass] %s\n", message.c_str());
}

/// L'instantané du banc : la vraie fenêtre, relue dans AppKit.
Json snapshot() {
  Json out = state && state->regions ? state->regions->snapshot()
                                     : Json{{"enabled", false}, {"surfaceVisible", false}, {"root", false},
                                            {"groups", 0}, {"nativeViews", 0}, {"regions", Json::array()},
                                            {"leaving", Json::array()}};
  const Availability availability = state ? state->availability : Availability::NotMacos;
  out["supported"] = availability == Availability::Native;
  out["availability"] = availabilityName(availability);
  out["refractsVideo"] = state && state->refractsVideo;
  // En plus (bancs CEF) : vues natives vivantes dans le processus, fenêtre composée.
  out["liveViews"] = availability == Availability::Native ? platform::liveNativeViews() : -1;
  out["windowVisible"] = state && platform::windowComposited(state->nativeWindow);
  return out;
}

void installChannels(AppContext& ctx) {
  ipc::registerHandler(kBatchChannel, [](const Json& payload, ipc::Responder r) {
    r.reply(nullptr);
    if (!state || !state->regions) return;
    const auto parsed = parseBatch(payload);
    if (!parsed) return complain("lot illisible, ignore");
    if (parsed->rejected > 0) complain(std::to_string(parsed->rejected) + " element(s) ecarte(s) par la validation");
    // La vue web couvre toute la vue de contenu, sans zoom : px CSS = points.
    state->regions->apply(parsed->batch, 1);
  });
  // Une page rechargée n'hérite pas du verre de la précédente : elle ne saurait même pas qu'il
  // est là (`did-navigate` d'Electron ; le routeur de la page n'en déclenche aucune).
  ipc::registerHandler(kPageStartedChannel, [](const Json&, ipc::Responder r) {
    if (state && state->regions) state->regions->clear();
    r.reply(nullptr);
  });
  state->sampler = std::make_unique<GlassSampler>(ctx.window, ctx.compositor);
  ipc::registerHandler(kSampleChannel, [](const Json& payload, ipc::Responder r) {
    const auto rects = parseSampleRects(payload);
    if (!state || !state->sampler || !rects || rects->empty()) return r.reply(Json::array());
    state->sampler->sample(*rects, [r](SampleResult result) {
      Json out = Json::array();
      for (const auto& v : result) out.push_back(v ? Json(*v) : Json(nullptr));
      r.reply(std::move(out));
    });
  });
}

}  // namespace

void install(AppContext& ctx) {
  state = std::make_unique<State>();
  state->nativeWindow = ctx.nativeWindow;
  const char* forced = std::getenv("TENTACLE_LIQUID_GLASS");
  state->availability = decideLiquidGlass({platform::name(), platform::systemVersion(),
                                           forced ? std::optional<std::string>(forced) : std::nullopt,
                                           [] { return platform::probeRuntime(); }});
  // Une ligne au démarrage : « pourquoi n'ai-je pas le verre ? » se lit ici.
  if (std::string(platform::name()) == "darwin")
    std::fprintf(stderr, "[liquid-glass] %s\n", availabilityName(state->availability));
  ipc::registerHandler(kSnapshotChannel, [](const Json&, ipc::Responder r) { r.reply(snapshot()); });
  if (state->availability != Availability::Native) return;
  state->backend = platform::createBackend(ctx);
  if (!state->backend) {
    std::fprintf(stderr, "[liquid-glass] fenetre sans verre (compositeur) : rien de branche\n");
    return;
  }
  state->refractsVideo = platform::refractsVideo();
  state->regions = std::make_unique<GlassRegions>(*state->backend, state->timers, [](const std::string& m) {
    std::fprintf(stderr, "[liquid-glass] %s\n", m.c_str());
  });
  // La page naît sur un fond opaque : verre caché tant qu'aucune vidéo n'est posée dessous.
  state->regions->setSurfaceVisible(false);
  pont::setOnSurfaceTransparent([](bool on) {
    if (state && state->regions) state->regions->setSurfaceVisible(on);
  });
  pont::setLiquidGlassShim(Json{{"refractsVideo", state->refractsVideo}});
  installChannels(ctx);
  // La fenêtre est partie pour de bon : plus aucune page ne parlerait à ce verre.
  lifecycle::onWindowClosed([] {
    if (state && state->regions) state->regions->clear();
  });
}

void shutdown() {
  if (!state) return;
  // shutdownModules passe AVANT la fenêtre et le compositeur : tout part proprement d'AppKit.
  if (state->regions) state->regions->clear();
  pont::setOnSurfaceTransparent(nullptr);
  ipc::unregisterHandler(kBatchChannel);
  ipc::unregisterHandler(kSampleChannel);
  ipc::unregisterHandler(kPageStartedChannel);
  state.reset();
}

}  // namespace tentacle::glass
