// Le cœur du moteur : la file, les fichiers qui partent, les fins, l'état. Le démarrage,
// la sortie, le niveau et le préchauffage sont dans `native_engine_io.cpp`.
#include "music/native_engine.h"

#include <cstdio>

namespace tentacle::music {
namespace {

using json = nlohmann::json;
constexpr int kStateIntervalMs = 250;
constexpr double kExpiryMarginMs = 60000;  // une source qui expire dans moins que cela est redemandée

int64_t unixMs() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

bool isNumber(const PropValue& v) { return std::holds_alternative<double>(v) || std::holds_alternative<int64_t>(v); }

json noticeJson(const QueueNotice& n) {
  if (n.type == QueueNotice::Kind::Swapped) return {{"type", "swapped"}, {"trackKey", n.trackKey}, {"origin", n.origin}};
  return {{"type", "advanced"}, {"fromKey", n.fromKey ? json(*n.fromKey) : json(nullptr)}, {"toKey", n.toKey ? json(*n.toKey) : json(nullptr)}};
}

}  // namespace

NativeAudioEngine::NativeAudioEngine(Scheduler& scheduler, std::unique_ptr<AudioBackend> backend, EngineConfig config, DeckEmit emit)
    : scheduler_(scheduler),
      backend_(std::move(backend)),
      config_(std::move(config)),
      emit_(std::move(emit)),
      timers_(scheduler),
      ends_(
          EndsHost{&queue_,
                   [this]() -> const LiveProps& { return props_; },
                   [this]() -> EngineFlags& { return flags_; },
                   [this] { return positionS(); },
                   [this] { return swapAtS_.has_value(); },
                   [this](QueueResult r) { run(std::move(r)); },
                   [this](const std::string& m, const EntryPtr& e) { fail(m, e->track.trackKey, e->source); },
                   [this] {
                     flags_.ended = true;
                     emitState();
                   },
                   [this] { emitState(); }},
          timers_) {}

NativeAudioEngine::~NativeAudioEngine() { *alive_ = false; }

void NativeAudioEngine::command(std::vector<std::string> args, AudioBackend::Done done) {
  // Une commande refusée par le cœur va au journal (`commandFailed` d'Electron) — jamais ses
  // arguments : une adresse de `loadfile` porte le jeton.
  const std::string name = args.empty() ? std::string("?") : args[0];
  backend_->command(std::move(args), [name, done = std::move(done)](std::optional<std::string> error, const json& result) {
    if (error) std::fprintf(stderr, "[music] %s refusée : %s\n", name.c_str(), error->c_str());
    if (done) done(error, result);
  });
}

void NativeAudioEngine::play(const Track& track, const Source& source, double startMs, bool paused) {
  ends_.provisional.reset();
  ends_.cuts.reset();
  pendingSeekS_.reset();
  flags_ = freshFlags(true);
  flags_.wantPaused = paused;
  if (paused) setProp("pause", "yes");
  props_ = LiveProps{};
  run(queue_.play(track, servedSource(overrides_, track.trackKey, source), startMs > 0 ? std::optional<double>(startMs / 1000) : std::nullopt));
  checkExpiry(track.trackKey, source);
}

void NativeAudioEngine::setNext(const std::optional<Track>& track, const std::optional<Source>& source) {
  std::optional<Source> served;
  if (track && source) served = servedSource(overrides_, track->trackKey, *source);
  run(queue_.setNext(track, served));
  if (track && served) checkExpiry(track->trackKey, *served);
}

void NativeAudioEngine::swap(const std::string& trackKey, const Source& source) {
  const double position = positionS();
  const auto durationMs = durationOf(queue_.current(), props_);
  const bool room = !durationMs || *durationMs / 1000 - position > config_.leadS + 0.5;
  const std::optional<double> at = room ? std::optional<double>(swapPoint(position, props_.sampleRate, config_.leadS)) : std::nullopt;
  SwapContext ctx{position, queue_.isStarted() && !flags_.awaitingRestart, props_.eofReached || flags_.reloading, at};
  auto result = queue_.swap(trackKey, source, ctx);
  if (!result) {
    overrides_[trackKey] = source;  // servie quand ce titre deviendra courant ou suivant
    return;
  }
  for (const auto& op : result->ops)
    if (op.op == QueueOp::Kind::SetEnd) swapAtS_ = at;
  if (flags_.reloading || props_.eofReached) ends_.clearReload();
  run(std::move(*result));
}

void NativeAudioEngine::control(const Control& c) {
  if (c.action == "pause") {
    flags_.wantPaused = true;
    setProp("pause", "yes");
  } else if (c.action == "resume") {
    flags_.wantPaused = false;
    if (flags_.ended) seekTo(0);
    setProp("pause", "no");
  } else if (c.action == "stop") {
    pendingSeekS_.reset();
    opening_ = false;
    ends_.clearReload();
    run(queue_.stop());
    flags_ = freshFlags(false);
    props_ = LiveProps{};
  } else if (c.action == "seek") {
    seekTo(c.value / 1000);
  } else {
    // Volume, sourdine, ReplayGain : des réglages, sans effet sur la file.
    for (auto& args : settingCommands(c, settings_, queue_.current())) command(std::move(args));
  }
  emitState();
}

void NativeAudioEngine::setChain(const std::optional<std::string>& expr) { setProp("af", chainFor(settings_.exclusive, expr)); }

void NativeAudioEngine::setGain(const std::string& expr) { command(gainCommand(expr)); }

DeckTimeline NativeAudioEngine::timeline() const { return deckTimeline(queue_.current(), props_, flags_, positionS()); }

void NativeAudioEngine::checkExpiry(const std::string& trackKey, const Source& source) {
  if (expiresSoon(source, static_cast<double>(unixMs()), kExpiryMarginMs)) emit_({{"type", "needSource"}, {"trackKey", trackKey}});
}

void NativeAudioEngine::seekTo(double seconds) {
  if (opening_ || flags_.awaitingRestart) {
    pendingSeekS_ = std::max(0.0, seconds);
    flags_.ended = false;
    return;
  }
  ends_.clearReload();
  flags_.ended = false;
  run(queue_.seek(std::max(0.0, seconds)));
}

void NativeAudioEngine::run(QueueResult result) {
  std::weak_ptr<bool> alive = alive_;
  for (const auto& op : result.ops) {
    auto args = opArgs(op, settings_.replayGain);
    const bool replace = op.op == QueueOp::Kind::Load && op.mode == QueueOp::Mode::Replace;
    if (replace) {
      // La pause de `keep-open` (fin du fichier d'avant) ne passe pas au suivant — sauf VOULUE.
      if (!flags_.wantPaused) setProp("pause", "no");
      flags_.awaitingRestart = true;
      props_.timePos.reset();
      props_.eofReached = false;
    }
    EntryPtr entry = op.op == QueueOp::Kind::Load ? op.entry : nullptr;
    command(std::move(args), [this, alive, entry, replace](std::optional<std::string> error, const json&) {
      if (alive.expired() || !error || !entry) return;
      queue_.loadFailed(entry->mpvId);
      if (!queue_.current() || replace) fail("load: " + *error, entry->track.trackKey, entry->source);
    });
  }
  for (const auto& n : result.notices) emit_(noticeJson(n));
  emitState();
}

void NativeAudioEngine::fail(const std::string& message, const std::string& trackKey, const Source& source) {
  std::fprintf(stderr, "[music] échec %s : %s\n", trackKey.c_str(), message.c_str());
  flags_.error = message;
  const bool expired = source.expiresAt && *source.expiresAt <= static_cast<double>(unixMs());
  if (source.origin == "plugin" || expired) emit_({{"type", "needSource"}, {"trackKey", trackKey}});
  emitState();
}

void NativeAudioEngine::onProperty(const std::string& name, const PropValue& value) {
  props_ = applyProperty(std::move(props_), name, value);
  if (name == "time-pos" && isNumber(value)) ends_.played();
  if (name == "eof-reached" && std::holds_alternative<bool>(value) && std::get<bool>(value)) ends_.eof();
  if (name != "demuxer-cache-time") return emitState(name == "time-pos" || name == "audio-bitrate");
  const EntryPtr current = queue_.current();
  if (current && !current->source.complete && cachedToEnd(props_.cacheTime, offsetOf(current), durationOf(current, props_)))
    run(queue_.markCurrentComplete());
}

double NativeAudioEngine::positionS() const { return props_.timePos.value_or(0) + offsetOf(queue_.current()); }

void NativeAudioEngine::onStartFile(int64_t mpvId) {
  const std::optional<double> before = props_.timePos ? std::optional<double>(positionS()) : std::nullopt;
  auto result = queue_.startFile(mpvId);
  if (!result) {
    if (mpvId != warmId_) std::fprintf(stderr, "[music] entrée mpv inconnue : %lld\n", static_cast<long long>(mpvId));
    return;
  }
  bool swapped = false;
  for (const auto& n : result->notices) swapped = swapped || n.type == QueueNotice::Kind::Swapped;
  if (swapped && swapAtS_ && before && *before > *swapAtS_ + 0.05)
    std::fprintf(stderr, "[music] bascule manquée : T=%.3f s, déjà à %.3f s\n", *swapAtS_, *before);
  if (swapped) swapAtS_.reset();
  opening_ = true;  // jusqu'à `playback-restart`
  // Nouveau fichier : fin pas atteinte, et la pause posée par `keep-open` levée.
  props_.eofReached = false;
  props_.timePos.reset();
  if (!flags_.wantPaused) setProp("pause", "no");
  if (!flags_.reloading) ends_.provisional.reset();
  flags_.reloading = false;
  flags_.ended = false;
  flags_.error.reset();
  run(std::move(*result));
}

// Au plus une émission par 250 ms pour ce qui bouge (la position) ; le reste part au tour
// suivant, REGROUPÉ : un fichier qui démarre change une dizaine de propriétés d'un coup.
void NativeAudioEngine::emitState(bool throttled) {
  if (!throttled) {
    if (stateQueued_) return;
    stateQueued_ = true;
    std::weak_ptr<bool> alive = alive_;
    scheduler_.post([this, alive] {
      if (alive.expired()) return;
      stateQueued_ = false;
      flushState();
    });
    return;
  }
  const auto now = std::chrono::steady_clock::now();
  const auto since = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastState_).count();
  if (since < kStateIntervalMs) {
    if (!timers_.pending(stateTimer_)) stateTimer_ = timers_.after(static_cast<int>(kStateIntervalMs - since), [this] { flushState(); });
    return;
  }
  flushState();
}

void NativeAudioEngine::flushState() {
  timers_.cancel(stateTimer_);
  lastState_ = std::chrono::steady_clock::now();
  emit_({{"type", "state"}, {"state", toJson(buildState(queue_.current(), props_, flags_, settings_))}, {"at", unixMs()}});
}

}  // namespace tentacle::music
