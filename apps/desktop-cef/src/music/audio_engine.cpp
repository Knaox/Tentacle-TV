#include "music/audio_engine.h"

#include <cstdio>
#include <utility>

namespace tentacle::music {
namespace {

using json = nlohmann::json;

const Observed kObserved = {
    {"time-pos", PropFormat::Double},          {"eof-reached", PropFormat::Flag},
    {"paused-for-cache", PropFormat::Flag},    {"audio-codec-name", PropFormat::String},
    {"file-format", PropFormat::String},       {"audio-params/samplerate", PropFormat::Int64},
    {"audio-params/channel-count", PropFormat::Int64}, {"audio-bitrate", PropFormat::Double},
    {"duration", PropFormat::Double},
};

std::optional<double> number(const PropValue& v) {
  if (auto d = std::get_if<double>(&v)) return *d;
  if (auto i = std::get_if<int64_t>(&v)) return static_cast<double>(*i);
  return std::nullopt;
}

std::string fixed(double s) {
  char buf[32];
  std::snprintf(buf, sizeof buf, "%.6f", s);
  return buf;
}

}  // namespace

AudioEngine::AudioEngine(Scheduler& scheduler, std::unique_ptr<AudioBackend> backend, Emit emit, Options extra)
    : scheduler_(scheduler), backend_(std::move(backend)), emit_(std::move(emit)), extra_(std::move(extra)) {}

AudioEngine::~AudioEngine() { *alive_ = false; }

void AudioEngine::start(const StartSettings& settings, StartDone done) {
  std::vector<std::string> headers;
  if (auto err = headerLines(settings.headers, headers)) return done(err, nullptr);
  settings_ = settings;
  if (!backend_->running()) {
    Options options = instanceOptions(settings, extra_);
    BackendEvents ev;
    ev.property = [this](const std::string& n, const PropValue& v) { onProperty(n, v); };
    ev.startFile = [this](int64_t id) { onStartFile(id); };
    ev.endFile = [this](int64_t id, int r, int e) { onEndFile(id, r, e); };
    ev.playbackRestart = [this] {
      flags_.awaitingRestart = false;
      flags_.opening = false;
      if (auto s = std::exchange(pendingSeekS_, std::nullopt)) seekTo(*s);
      emitState();
    };
    if (auto err = backend_->start(options, kObserved, std::move(ev))) return done(err, nullptr);
  }
  // Les en-têtes, un élément chacun (`change-list … append`) : une virgule ne
  // coupe pas la valeur. Commandes en ordre : posées avant tout `loadfile`.
  // Un nouveau jeton (redémarrage du moteur) remplace simplement la liste.
  backend_->command({"change-list", "http-header-fields", "clr", ""});
  for (const auto& h : headers) backend_->command({"change-list", "http-header-fields", "append", h});
  backend_->getProperty("decoder-list", [done](json list) {
    static const std::set<std::string> audio = {"flac", "alac", "mp3", "mp3float", "aac", "aac_at", "opus",
                                                "libopus", "vorbis", "wavpack", "ape", "tta", "pcm_s16le",
                                                "pcm_s24le", "ac3", "eac3", "dsd_lsbf"};
    std::set<std::string> codecs;
    if (list.is_array())
      for (const auto& d : list)
        if (d.contains("codec") && audio.count(d.value("driver", ""))) codecs.insert(d["codec"].get<std::string>());
    done(std::nullopt, json{{"engine", "mpv"},
                            {"gapless", true},
                            {"exclusiveOutput", false},
                            {"replayGain", true},
                            {"codecs", json(codecs)},
                            {"hotSwap", false}});
  });
}

void AudioEngine::play(const Track& track, const Source& source, double startMs) {
  flags_ = Flags{};
  flags_.awaitingRestart = true;
  props_ = Props{};
  earlyStarts_.clear();
  pendingSeekS_.reset();
  auto entry = std::make_shared<Entry>();
  entry->track = track;
  entry->source = source;
  entry->startS = startMs > 0 ? startMs / 1000.0 : 0;
  current_ = entry;
  next_.reset();
  // La pause de `keep-open` (fin du fichier d'avant) ne passe pas au nouveau titre.
  backend_->command({"set", "pause", "no"});
  load(entry, true);
  emitState();
}

void AudioEngine::setNext(const std::optional<Track>& track, const std::optional<Source>& source) {
  if (next_) {
    // Retiré de la liste de mpv : il est toujours derrière le titre en cours (index 1).
    backend_->command({"playlist-remove", "1"});
    next_.reset();
  }
  if (!track || !source || !current_) return;
  auto entry = std::make_shared<Entry>();
  entry->advance = true;
  entry->track = *track;
  entry->source = *source;
  entry->fromKey = current_->track.trackKey;
  next_ = entry;
  load(entry, false);
}

void AudioEngine::swap(const std::string& trackKey, const Source& source) {
  // Sans bascule à chaud : le titre en cours est relu à sa position, le suivant remplacé.
  if (current_ && current_->track.trackKey == trackKey) {
    double pos = props_.timePos.value_or(current_->startS);
    Track t = current_->track;
    auto keepNext = next_;
    bool paused = flags_.wantPaused;
    play(t, source, pos * 1000);
    flags_.wantPaused = paused;
    if (paused) backend_->command({"set", "pause", "yes"});
    if (keepNext) setNext(keepNext->track, keepNext->source);
    emitEvent({{"type", "swapped"}, {"trackKey", trackKey}, {"origin", source.origin}});
  } else if (next_ && next_->track.trackKey == trackKey) {
    setNext(next_->track, source);
  }
}

void AudioEngine::load(std::shared_ptr<Entry> entry, bool replace) {
  std::vector<std::pair<std::string, std::string>> opts;
  if (entry->startS > 0) opts.emplace_back("start", fixed(entry->startS));
  std::weak_ptr<bool> alive = alive_;
  backend_->command({"loadfile", entry->source.url, replace ? "replace" : "append", "-1", fileOptions(opts)},
                    [this, alive, entry](std::optional<std::string> err, const json& result) {
                      if (alive.expired()) return;
                      if (err) {
                        if (entry == current_) fail("load: " + *err, *entry);
                        if (entry == next_) next_.reset();
                        return;
                      }
                      if (result.is_object() && result.contains("playlist_entry_id"))
                        entry->mpvId = result["playlist_entry_id"].get<int64_t>();
                      if (earlyStarts_.erase(entry->mpvId)) onStartFile(entry->mpvId);
                    });
}

std::optional<std::string> AudioEngine::control(const json& c) {
  std::string action = c.value("action", "");
  if (action == "pause") {
    flags_.wantPaused = true;
    backend_->command({"set", "pause", "yes"});
  } else if (action == "resume") {
    flags_.wantPaused = false;
    if (flags_.ended) seekTo(0);
    backend_->command({"set", "pause", "no"});
  } else if (action == "stop") {
    backend_->command({"stop"});
    current_.reset();
    next_.reset();
    earlyStarts_.clear();
    flags_ = Flags{};
    props_ = Props{};
  } else if (action == "seek") {
    if (!c.contains("value") || !c["value"].is_number()) return "seek: value attendu";
    seekTo(std::max(0.0, c["value"].get<double>() / 1000.0));
  } else if (action == "volume") {
    if (!c.contains("value") || !c["value"].is_number()) return "volume: value attendu";
    settings_.volume = std::min(1.0, std::max(0.0, c["value"].get<double>()));
    if (!forcedSilence()) backend_->command({"set", "volume", std::to_string(std::lround(settings_.volume * 100))});
  } else if (action == "muted") {
    settings_.muted = c.value("value", false);
    if (!forcedSilence()) backend_->command({"set", "mute", settings_.muted ? "yes" : "no"});
  } else if (action == "replayGain") {
    std::string mode = c.value("mode", "auto");
    settings_.replayGain = mode;
    backend_->command({"set", "replaygain", mode == "off" ? "no" : (mode == "album" ? "album" : "track")});
  } else if (action != "crossfade") {  // le fondu enchaîné n'est pas repris : accepté, sans effet
    return "action inconnue : " + action;
  }
  emitState();
  return std::nullopt;
}

void AudioEngine::seekTo(double seconds) {
  flags_.ended = false;
  if (!current_) return;
  if (flags_.awaitingRestart || flags_.opening) {
    pendingSeekS_ = seconds;
    return;
  }
  std::weak_ptr<bool> alive = alive_;
  auto target = current_;
  backend_->command({"seek", fixed(seconds), "absolute+exact"},
                    [this, alive, target, seconds](std::optional<std::string> err, const json&) {
                      // Refusé pendant l'ouverture du titre (passage au suivant) : au prochain départ.
                      if (err && !alive.expired() && target == current_) pendingSeekS_ = seconds;
                    });
}

void AudioEngine::listOutputs(std::function<void(json)> done) {
  backend_->getProperty("audio-device-list", [done](json list) {
    json out = json::array();
    if (list.is_array())
      for (const auto& d : list)
        out.push_back({{"id", d.value("name", "")}, {"name", d.value("description", "")}, {"exclusiveCapable", false}});
    done(out);
  });
}

void AudioEngine::setOutput(const std::optional<std::string>& deviceId,
                            std::function<void(std::optional<std::string>)> done) {
  settings_.deviceId = deviceId;
  backend_->command({"set", "audio-device", deviceId.value_or("auto")},
                    [done](std::optional<std::string> err, const json&) { done(err); });
  emitState();
}

void AudioEngine::dispose(std::function<void()> done) {
  current_.reset();
  next_.reset();
  backend_->destroy(std::move(done));
}

bool AudioEngine::onVideoClaim() {
  std::string s = status();
  if (s != "playing" && s != "loading" && s != "buffering") return false;
  control({{"action", "pause"}});
  // La page tient l'intention « lecture » : elle l'apprend comme d'une touche système.
  emitEvent({{"type", "remote"}, {"command", "pause"}});
  return true;
}

void AudioEngine::readProperty(const std::string& name, std::function<void(json)> done) {
  backend_->getProperty(name, std::move(done));
}

void AudioEngine::onProperty(const std::string& name, const PropValue& value) {
  auto n = number(value);
  auto str = std::get_if<std::string>(&value);
  bool flag = std::holds_alternative<bool>(value) && std::get<bool>(value);
  if (name == "time-pos") props_.timePos = n;
  else if (name == "eof-reached") {
    props_.eofReached = flag;
    // `keep-open` : mpv s'arrête en pause sur la fin du DERNIER titre.
    if (flag && current_ && !next_) flags_.ended = true;
  } else if (name == "paused-for-cache") props_.pausedForCache = flag;
  else if (name == "audio-codec-name") props_.codec = str ? std::optional<std::string>(*str) : std::nullopt;
  else if (name == "file-format") props_.fileFormat = str ? std::optional<std::string>(*str) : std::nullopt;
  else if (name == "audio-params/samplerate") props_.sampleRate = n;
  else if (name == "audio-params/channel-count") props_.channels = n;
  else if (name == "audio-bitrate") props_.bitrate = n;
  else if (name == "duration") props_.duration = n;
  emitState(name == "time-pos" || name == "audio-bitrate");
}

void AudioEngine::onStartFile(int64_t id) {
  if (current_ && current_->mpvId == id) {
    flags_.error.reset();
  } else if (next_ && next_->mpvId == id) {
    // Le suivant part : mpv a enchaîné seul. L'ancien sort de la liste de mpv.
    emitEvent({{"type", "advanced"}, {"fromKey", next_->fromKey ? json(*next_->fromKey) : json(nullptr)},
               {"toKey", next_->track.trackKey}});
    backend_->command({"playlist-remove", "0"});
    current_ = next_;
    current_->advance = false;
    pendingSeekS_.reset();
    flags_.opening = true;
    next_.reset();
    props_.timePos.reset();
    props_.eofReached = false;
    flags_.ended = false;
    flags_.error.reset();
    if (!flags_.wantPaused) backend_->command({"set", "pause", "no"});
  } else if ((current_ && current_->mpvId < 0) || (next_ && next_->mpvId < 0)) {
    earlyStarts_.insert(id);  // la réponse de `loadfile` n'est pas encore là
    return;
  } else {
    return;  // une entrée oubliée (remplacée entre-temps)
  }
  emitState();
}

void AudioEngine::onEndFile(int64_t id, int reason, int error) {
  if (reason != 4 || !current_ || current_->mpvId != id) return;  // 4 = MPV_END_FILE_REASON_ERROR
  fail("lecture impossible (mpv " + std::to_string(error) + ")", *current_);
}

void AudioEngine::fail(const std::string& message, const Entry& entry) {
  std::fprintf(stderr, "[music] echec %s : %s\n", entry.track.trackKey.c_str(), message.c_str());
  flags_.error = message;
  if (entry.source.origin == "plugin") emitEvent({{"type", "needSource"}, {"trackKey", entry.track.trackKey}});
  emitState();
}

void AudioEngine::emitEvent(json event) { emit_(std::move(event)); }

}  // namespace tentacle::music
