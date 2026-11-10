#include "music/octave_channels.h"

#include <algorithm>
#include <cstdio>

#include "music/crossfade_decks.h"
#include "music/native_engine.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

}  // namespace

const std::vector<std::string>& OctaveChannels::commands() {
  static const std::vector<std::string> list = {
      "audio_engine_start", "audio_engine_stop",  "audio_play",       "audio_set_next", "audio_swap_source",
      "audio_control",      "audio_list_outputs", "audio_set_output", "audio_level",
  };
  return list;
}

OctaveChannels::OctaveChannels(Scheduler& scheduler, BackendFactory makeBackend, Options extraOptions)
    : scheduler_(scheduler), makeBackend_(std::move(makeBackend)), extra_(std::move(extraOptions)) {}

OctaveChannels::~OctaveChannels() { *alive_ = false; }

void OctaveChannels::install(const Register& registerHandler, Emit emit) {
  emit_ = std::move(emit);
  for (const auto& channel : commands())
    registerHandler(channel, [this, channel](const json& args, Reply reply, Fail fail) {
      dispatch(channel, args, std::move(reply), std::move(fail));
    });
}

void OctaveChannels::emitEvent(const json& event) {
  if (event.value("type", "") == "state" && event.contains("state")) status_ = event["state"].value("status", "idle");
  if (emit_) emit_(kEvent, event);
}

void OctaveChannels::checked(Source source, const std::string& trackKey, std::function<void(std::optional<std::string>, Source)> done) {
  // La copie gardée hors ligne, cherchée par la coquille elle-même — sous la clé de la copie si le
  // titre a changé d'identité depuis ; absente : le serveur.
  if (source.kept && kept_) {
    if (auto local = kept_(source.kept->userId, source.kept->trackKey.value_or(trackKey))) {
      Source plain = source;
      plain.kept.reset();
      plain.direct.reset();
      plain.url = *local;
      plain.complete = true;
      plain.expiresAt.reset();
      return done(std::nullopt, std::move(plain));
    }
  }
  source.kept.reset();
  if (auto refusal = refuseSource(source.url, serverOrigin_)) return done(refusal, source);
  // Un flux direct déclaré par l'extension : par le relais local, ce serveur en repli.
  if (source.direct && direct_ && serverOrigin_) {
    std::weak_ptr<bool> alive = alive_;
    return direct_(source, trackKey, DirectSession{*serverOrigin_, serverHeaders_}, [alive, done](Source adopted) {
      if (!alive.expired()) done(std::nullopt, std::move(adopted));
    });
  }
  source.direct.reset();  // sans relais : le serveur, comme le repli d'Electron
  done(std::nullopt, std::move(source));
}

void OctaveChannels::dispatch(const std::string& channel, const json& args, Reply reply, Fail fail) {
  const json a = args.is_object() ? args : json::object();
  if (channel == "audio_engine_start") return start(a, std::move(reply), std::move(fail));
  if (channel == "audio_engine_stop") return stop(std::move(reply));
  // Lu par la houle d'Octave quelques fois par seconde ; moteur arrêté : rien.
  if (channel == "audio_level") {
    if (!engine_) return reply(nullptr);
    return engine_->level([reply](std::optional<double> db) { reply(db ? json(*db) : json(nullptr)); });
  }
  if (!engine_) return fail("not_started", "moteur audio non démarré");
  CrossfadeDecks* engine = engine_.get();
  std::weak_ptr<bool> alive = alive_;
  auto stillOurs = [this, alive, engine] { return !alive.expired() && engine_.get() == engine; };

  if (channel == "audio_play") {
    Track track;
    Source source;
    if (auto e = parseTrack(a.value("track", json()), track)) return fail("invalid_args", "arguments invalides pour audio_play: " + *e);
    if (auto e = parseSource(a.value("source", json()), source)) return fail("invalid_args", "arguments invalides pour audio_play: " + *e);
    if (!a.contains("startMs") || !a["startMs"].is_number() || a["startMs"].get<double>() < 0)
      return fail("invalid_args", "arguments invalides pour audio_play: startMs");
    const double startMs = a["startMs"].get<double>();
    return checked(source, track.trackKey, [=](std::optional<std::string> error, Source served) {
      if (error) return fail("source_refused", *error);
      if (stillOurs()) engine->play(track, served, startMs);
      reply(nullptr);
    });
  }
  if (channel == "audio_set_next") {
    std::optional<Track> track;
    const double fadeMs = a.value("crossfadeMs", 0.0);
    if (fadeMs < 0 || fadeMs > 12000) return fail("invalid_args", "arguments invalides pour audio_set_next: crossfadeMs");
    if (a.contains("track") && !a["track"].is_null()) {
      Track t;
      if (auto e = parseTrack(a["track"], t)) return fail("invalid_args", "arguments invalides pour audio_set_next: " + *e);
      track = t;
    }
    Source s;
    const bool hasSource = a.contains("source") && !a["source"].is_null();
    if (hasSource)
      if (auto e = parseSource(a["source"], s)) return fail("invalid_args", "arguments invalides pour audio_set_next: " + *e);
    if (!track || !hasSource) {
      engine->setNext(track, std::nullopt, fadeMs);
      return reply(nullptr);
    }
    return checked(s, track->trackKey, [=](std::optional<std::string> error, Source served) {
      if (error) return fail("source_refused", *error);
      if (stillOurs()) engine->setNext(track, served, fadeMs);
      reply(nullptr);
    });
  }
  if (channel == "audio_swap_source") {
    Source s;
    const std::string key = a.value("trackKey", std::string());
    if (key.empty() || key.size() > 512) return fail("invalid_args", "arguments invalides pour audio_swap_source: trackKey");
    if (auto e = parseSource(a.value("source", json()), s)) return fail("invalid_args", "arguments invalides pour audio_swap_source: " + *e);
    return checked(s, key, [=](std::optional<std::string> error, Source served) {
      if (error) return fail("source_refused", *error);
      if (stillOurs()) engine->swap(key, served);
      reply(nullptr);
    });
  }
  if (channel == "audio_control") {
    Control c;
    if (auto e = parseControl(a, c)) return fail("invalid_args", "arguments invalides pour audio_control: " + *e);
    engine->control(c);
    return reply(nullptr);
  }
  if (channel == "audio_list_outputs") return engine->listOutputs(std::move(reply));
  if (channel == "audio_set_output") {
    std::optional<std::string> deviceId;
    if (a.contains("deviceId") && a["deviceId"].is_string()) deviceId = a["deviceId"].get<std::string>();
    return engine->setOutput(deviceId, a.value("exclusive", false), [reply, fail](std::optional<std::string> err) {
      if (err) return fail("output", *err);
      reply(nullptr);
    });
  }
  fail("unknown_channel", channel);
}

void OctaveChannels::start(const json& a, Reply reply, Fail fail) {
  StartSettings s;
  if (auto e = parseStart(a, s)) return fail("invalid_args", "arguments invalides pour audio_engine_start: " + *e);
  if (!engine_) {
    std::weak_ptr<bool> alive = alive_;
    auto factory = [this](DeckEmit emit) -> std::unique_ptr<Deck> {
      EngineConfig config;
      config.extraOptions = extra_;
      return std::make_unique<NativeAudioEngine>(scheduler_, makeBackend_(), config, std::move(emit));
    };
    auto owner = std::make_shared<CrossfadeDecks*>(nullptr);
    engine_ = std::make_unique<CrossfadeDecks>(scheduler_, factory, [this, alive, owner](const json& e) {
      // Un moteur qui s'arrête ne parle plus à la page (un plus récent peut être né).
      if (!alive.expired() && engine_.get() == *owner) emitEvent(e);
    });
    *owner = engine_.get();
  }
  serverOrigin_ = s.serverOrigin;
  serverHeaders_ = s.headers;
  if (prefetch_) prefetch_(DirectSession{s.serverOrigin, s.headers});
  engine_->start(s, [reply, fail](std::optional<std::string> err, json caps) {
    if (err) return fail("engine_start", *err);
    reply(std::move(caps));
  });
}

void OctaveChannels::stop(Reply reply) {
  serverOrigin_.reset();
  if (!engine_) return reply(nullptr);
  CrossfadeDecks* raw = engine_.get();
  stopping_.push_back(std::move(engine_));
  status_ = "idle";
  std::weak_ptr<bool> alive = alive_;
  // L'arrêt rend la main à `SHUTDOWN` (ou au filet de 3 s) : la sortie audio est libérée.
  raw->dispose([this, alive, raw, reply] {
    if (!alive.expired())
      scheduler_.post([this, alive, raw] {
        if (!alive.expired()) std::erase_if(stopping_, [raw](const auto& e) { return e.get() == raw; });
      });
    reply(nullptr);
  });
}

bool OctaveChannels::onVideoClaim() {
  const bool playing = engine_ && (status_ == "playing" || status_ == "loading" || status_ == "buffering");
  if (playing) {
    engine_->control(Control::of("pause"));
    // La page tient l'intention « lecture » : elle l'apprend comme d'une touche système.
    emitRemote("pause");
  }
  std::fprintf(stderr, "[music] lecture vidéo : musique %s\n", playing ? "mise en pause" : "déjà au repos");
  return playing;
}

void OctaveChannels::emitRemote(const std::string& command) {
  if (engine_) emitEvent({{"type", "remote"}, {"command", command}});
}

void OctaveChannels::controlNative(const Control& c) {
  if (engine_) engine_->control(c);
}

void OctaveChannels::sourceCut(const std::string& url) {
  if (engine_) engine_->sourceCut(url);
}

void OctaveChannels::stopAudio() {
  if (engine_) engine_->control(Control::of("stop"));
}

void OctaveChannels::readProperty(const std::string& name, std::function<void(json)> done) {
  if (!engine_) return done(nullptr);
  engine_->readProperty(name, std::move(done));
}

}  // namespace tentacle::music
