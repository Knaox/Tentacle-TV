#include "music/octave_channels.h"

#include <algorithm>
#include <cstdio>

#include "music/audio_engine.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

std::optional<std::string> optString(const json& j, const char* key) {
  auto it = j.find(key);
  return it != j.end() && it->is_string() ? std::optional<std::string>(it->get<std::string>()) : std::nullopt;
}

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

OctaveChannels::~OctaveChannels() = default;

void OctaveChannels::install(const Register& registerHandler, Emit emit) {
  emit_ = std::move(emit);
  for (const auto& channel : commands())
    registerHandler(channel, [this, channel](const json& args, Reply reply, Fail fail) {
      dispatch(channel, args, std::move(reply), std::move(fail));
    });
}

void OctaveChannels::dispatch(const std::string& channel, const json& args, Reply reply, Fail fail) {
  const json a = args.is_object() ? args : json::object();
  if (channel == "audio_engine_start") return start(a, std::move(reply), std::move(fail));
  if (channel == "audio_engine_stop") return stop(std::move(reply));
  if (channel == "audio_level") return reply(nullptr);  // la houle d'Octave : non reprise
  if (!engine_) return fail("not_started", "moteur audio non demarre");

  if (channel == "audio_play") {
    Track track;
    Source source;
    if (auto e = parseTrack(a.value("track", json()), track)) return fail("invalid_args", *e);
    if (auto e = parseSource(a.value("source", json()), source)) return fail("invalid_args", *e);
    if (auto e = refuseSource(source.url, engine_->serverOrigin())) return fail("source_refused", *e);
    engine_->play(track, source, std::max(0.0, a.value("startMs", 0.0)));
    return reply(nullptr);
  }
  if (channel == "audio_set_next") {
    std::optional<Track> track;
    std::optional<Source> source;
    if (a.contains("track") && a["track"].is_object() && a.contains("source") && a["source"].is_object()) {
      Track t;
      Source s;
      if (auto e = parseTrack(a["track"], t)) return fail("invalid_args", *e);
      if (auto e = parseSource(a["source"], s)) return fail("invalid_args", *e);
      if (auto e = refuseSource(s.url, engine_->serverOrigin())) return fail("source_refused", *e);
      track = t;
      source = s;
    }
    engine_->setNext(track, source);
    return reply(nullptr);
  }
  if (channel == "audio_swap_source") {
    Source s;
    auto key = optString(a, "trackKey");
    if (!key) return fail("invalid_args", "trackKey attendu");
    if (auto e = parseSource(a.value("source", json()), s)) return fail("invalid_args", *e);
    if (auto e = refuseSource(s.url, engine_->serverOrigin())) return fail("source_refused", *e);
    engine_->swap(*key, s);
    return reply(nullptr);
  }
  if (channel == "audio_control") {
    if (auto e = engine_->control(a)) return fail("invalid_args", *e);
    return reply(nullptr);
  }
  if (channel == "audio_list_outputs") return engine_->listOutputs(std::move(reply));
  if (channel == "audio_set_output") {
    return engine_->setOutput(optString(a, "deviceId"), [reply, fail](std::optional<std::string> err) {
      if (err) return fail("output", *err);
      reply(nullptr);
    });
  }
  fail("unknown_channel", channel);
}

void OctaveChannels::start(const json& a, Reply reply, Fail fail) {
  StartSettings s;
  auto origin = optString(a, "serverOrigin");
  if (!origin || origin->empty()) return fail("invalid_args", "serverOrigin attendu");
  s.serverOrigin = *origin;
  if (a.contains("headers") && a["headers"].is_object())
    for (const auto& [k, v] : a["headers"].items())
      if (v.is_string()) s.headers[k] = v.get<std::string>();
  s.volume = a.value("volume", 1.0);
  s.muted = a.value("muted", false);
  s.replayGain = a.value("replayGain", std::string("auto"));
  s.deviceId = optString(a, "deviceId");
  if (!engine_) {
    engine_ = std::make_unique<AudioEngine>(scheduler_, makeBackend_(), [this](json e) {
      if (emit_) emit_(kEvent, std::move(e));
    }, extra_);
  }
  engine_->start(s, [reply, fail](std::optional<std::string> err, json caps) {
    if (err) return fail("engine_start", *err);
    reply(std::move(caps));
  });
}

void OctaveChannels::stop(Reply reply) {
  if (!engine_) return reply(nullptr);
  AudioEngine* raw = engine_.get();
  raw->detachEmit();
  stopping_.push_back(std::move(engine_));
  // L'arrêt rend la main à `SHUTDOWN` (ou au filet de 3 s) : la sortie audio est libérée.
  raw->dispose([this, raw, reply] {
    scheduler_.post([this, raw] {
      std::erase_if(stopping_, [raw](const auto& e) { return e.get() == raw; });
    });
    reply(nullptr);
  });
}

bool OctaveChannels::onVideoClaim() {
  bool paused = engine_ && engine_->onVideoClaim();
  std::fprintf(stderr, "[music] lecture video : musique %s\n", paused ? "mise en pause" : "deja au repos");
  return paused;
}

}  // namespace tentacle::music
