// Le moteur face à son instance mpv : naissance (options, en-têtes, préchauffage de la
// sortie), sortie et mode exclusif (`audioEngineOutput.ts`), niveau (`audioLevel.ts`), arrêt.
#include <cstdio>
#include <memory>
#include <utility>

#include "music/native_engine.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

// `outputWarmup.ts` : 50 ms de silence NUMÉRIQUE, en sourdine, par la vraie sortie, à la
// naissance — le recensement des composants audio (~2 s à froid sur macOS) se fait là, pas
// au premier clic. L'entrée ne garde pas la sortie ouverte (`keep-open=no`).
constexpr const char* kWarmupUrl = "av://lavfi:anullsrc=r=48000:cl=stereo";

EndKind endKind(int reason) {
  if (reason == 0) return EndKind::Eof;    // MPV_END_FILE_REASON_EOF
  if (reason == 4) return EndKind::Error;  // MPV_END_FILE_REASON_ERROR
  return EndKind::Other;
}

}  // namespace

std::vector<std::string> warmupArgs() {
  return {"loadfile", kWarmupUrl, "replace", "-1", formatFileOptions({{"end", "0.05"}, {"mute", "yes"}, {"keep-open", "no"}})};
}

void NativeAudioEngine::start(const StartSettings& start, StartDone done) {
  settings_ = Settings{start.volume, start.muted, start.deviceId, start.exclusive, start.replayGain};
  std::vector<std::string> headers;
  if (auto err = headerLines(start.headers, headers)) return done(err, nullptr);
  const bool born = !backend_->running();
  if (born) {
    std::weak_ptr<bool> alive = alive_;
    BackendEvents ev;
    ev.property = [this, alive](const std::string& n, const PropValue& v) {
      if (!alive.expired()) onProperty(n, v);
    };
    ev.startFile = [this, alive](int64_t id) {
      if (!alive.expired()) onStartFile(id);
    };
    ev.endFile = [this, alive](int64_t id, int reason, int error) {
      if (!alive.expired()) ends_.endFile(id, endKind(reason), error);
    };
    ev.playbackRestart = [this, alive] {
      if (alive.expired()) return;
      flags_.awaitingRestart = false;
      opening_ = false;
      if (auto s = std::exchange(pendingSeekS_, std::nullopt)) seekTo(*s);
      emitState();
    };
    if (auto err = backend_->start(startOptions(config_.platform, start, config_.extraOptions), observedProperties(), std::move(ev)))
      return done(err, nullptr);
  }
  // Les en-têtes d'authentification, un élément chacun : posés avant tout `loadfile` (les
  // commandes partent dans l'ordre) ; un nouveau jeton remplace simplement la liste.
  command({"change-list", "http-header-fields", "clr", ""});
  for (const auto& h : headers) command({"change-list", "http-header-fields", "append", h});
  if (born && config_.warmOutput) warmOutput();
  backend_->getProperty("decoder-list", [done](json list) { done(std::nullopt, mpvCapabilities(codecsFromDecoderList(list))); });
}

void NativeAudioEngine::warmOutput() {
  const int64_t id = queue_.reserveId();
  warmId_ = id;
  std::weak_ptr<bool> alive = alive_;
  command(warmupArgs(), [this, alive, id](std::optional<std::string> error, const json&) {
    if (alive.expired() || !error) return;
    queue_.loadFailed(id);  // mpv n'a rien numéroté : la suite se recale
    std::fprintf(stderr, "[music] préchauffage de la sortie refusé : %s\n", error->c_str());
  });
}

void NativeAudioEngine::listOutputs(std::function<void(json)> done) {
  const Platform platform = config_.platform;
  backend_->getProperty("audio-device-list", [platform, done](json list) { done(parseOutputs(platform, list)); });
}

void NativeAudioEngine::setOutput(const std::optional<std::string>& deviceId, bool exclusive, Done done) {
  // La chaîne suit le mode exclusif : posée ou retirée avec la sortie, qui se rouvre de toute façon.
  Options options = outputOptions(config_.platform, deviceId, exclusive);
  if (exclusive != settings_.exclusive) options.emplace_back("af", chainFor(exclusive, std::nullopt));
  settings_.deviceId = deviceId;
  settings_.exclusive = exclusive;
  struct Pending {
    size_t left;
    std::string errors;
    Done done;
  };
  auto pending = std::make_shared<Pending>(Pending{options.size(), {}, std::move(done)});
  std::weak_ptr<bool> alive = alive_;
  for (const auto& [k, v] : options) {
    command({"set", k, v}, [this, alive, pending](std::optional<std::string> error, const json&) {
      if (error) pending->errors += (pending->errors.empty() ? "" : " ; ") + *error;
      if (--pending->left > 0) return;
      if (!alive.expired()) emitState();
      pending->done(pending->errors.empty() ? std::nullopt : std::optional<std::string>(pending->errors));
    });
  }
}

void NativeAudioEngine::level(std::function<void(std::optional<double>)> done) {
  // `null` hors lecture ou en mode exclusif (aucun filtre de mesure : sortie bit pour bit).
  if (settings_.exclusive || deriveStatus(queue_.current(), props_, flags_) != "playing") return done(std::nullopt);
  backend_->getProperty(kLevelProperty, [done](json v) {
    done(parseLevel(v.is_string() ? std::optional<std::string>(v.get<std::string>()) : std::nullopt));
  });
}

void NativeAudioEngine::readProperty(const std::string& name, std::function<void(json)> done) {
  backend_->getProperty(name, std::move(done));
}

void NativeAudioEngine::dispose(std::function<void()> done) {
  ends_.clearReload();
  timers_.cancelAll();
  stateQueued_ = true;  // plus aucun état ne part : l'instance s'en va
  backend_->destroy(std::move(done));
}

}  // namespace tentacle::music
