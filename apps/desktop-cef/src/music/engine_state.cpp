#include "music/engine_state.h"

#include <cmath>

#include "music/audio_options.h"
#include "music/crossfade_rules.h"

namespace tentacle::music {
namespace {

std::optional<double> number(const PropValue& v) {
  if (auto d = std::get_if<double>(&v)) return std::isfinite(*d) ? std::optional<double>(*d) : std::nullopt;
  if (auto i = std::get_if<int64_t>(&v)) return static_cast<double>(*i);
  return std::nullopt;
}

std::optional<std::string> text(const PropValue& v) {
  if (auto s = std::get_if<std::string>(&v)) return *s;
  return std::nullopt;
}

bool flag(const PropValue& v) { return std::holds_alternative<bool>(v) && std::get<bool>(v); }

const char* modeName(QueueOp::Mode m) {
  switch (m) {
    case QueueOp::Mode::Replace: return "replace";
    case QueueOp::Mode::Append: return "append";
    case QueueOp::Mode::InsertNext: return "insert-next";
  }
  return "replace";
}

}  // namespace

std::string deriveStatus(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags) {
  if (flags.error) return "error";
  if (!current) return "idle";
  if (flags.ended) return "ended";
  // Seul un CHARGEMENT dit « loading » : au passage sans blanc, `time-pos` disparaît un instant.
  if (flags.awaitingRestart) return "loading";
  if (flags.reloading || props.pausedForCache) return "buffering";
  return flags.wantPaused ? "paused" : "playing";
}

std::optional<double> durationOf(const EntryPtr& current, const LiveProps& props) {
  if (!current) return std::nullopt;
  // La durée d'une entrée EDL (bascule) est celle du segment, pas du titre.
  const bool own = current->source.complete && offsetOf(current) == 0;
  if (own && props.mpvDuration && *props.mpvDuration > 0) return std::round(*props.mpvDuration * 1000);
  return current->source.durationMs ? current->source.durationMs : current->track.durationMs;
}

BridgeState buildState(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags, const Settings& settings) {
  BridgeState s;
  s.status = deriveStatus(current, props, flags);
  const double startMs = current && current->startS ? *current->startS * 1000 : 0;
  const double positionMs = s.status == "loading" || !props.timePos ? startMs : (*props.timePos + offsetOf(current)) * 1000;
  s.trackKey = current ? std::optional<std::string>(current->track.trackKey) : std::nullopt;
  s.positionMs = std::max(0.0, std::round(positionMs));
  s.durationMs = durationOf(current, props);
  s.volume = settings.volume;
  s.muted = settings.muted;
  if (current) s.format = decodedFormat({props.codecName, props.fileFormat, props.sampleRate, props.channels, props.bitrate}, current->track.format);
  s.deviceId = settings.deviceId;
  s.exclusive = settings.exclusive;
  s.error = flags.error;
  return s;
}

const Observed& observedProperties() {
  static const Observed list = {
      {"time-pos", PropFormat::Double},          {"eof-reached", PropFormat::Flag},
      {"paused-for-cache", PropFormat::Flag},    {"audio-codec-name", PropFormat::String},
      {"file-format", PropFormat::String},       {"audio-params/samplerate", PropFormat::Int64},
      {"audio-params/channel-count", PropFormat::Int64}, {"audio-bitrate", PropFormat::Double},
      {"duration", PropFormat::Double},          {"demuxer-cache-time", PropFormat::Double},
  };
  return list;
}

LiveProps applyProperty(LiveProps p, const std::string& name, const PropValue& value) {
  if (name == "time-pos") p.timePos = number(value);
  else if (name == "eof-reached") p.eofReached = flag(value);
  else if (name == "paused-for-cache") p.pausedForCache = flag(value);
  else if (name == "audio-codec-name") p.codecName = text(value);
  else if (name == "file-format") p.fileFormat = text(value);
  else if (name == "audio-params/samplerate") p.sampleRate = number(value);
  else if (name == "audio-params/channel-count") p.channels = number(value);
  else if (name == "audio-bitrate") p.bitrate = number(value);
  else if (name == "duration") p.mpvDuration = number(value);
  else if (name == "demuxer-cache-time") p.cacheTime = number(value);
  return p;
}

Options entryOptions(const QueueEntry& entry, const std::string& mode) {
  Options options;
  if (entry.startS && *entry.startS > 0) options.emplace_back("start", fixed6(*entry.startS));
  for (const auto& kv : partialStreamOptions(entry.source.complete)) options.push_back(kv);
  const std::string gain = effectiveGainMode(mode, entry.track.albumKey, entry.neighbours);
  for (const auto& kv : replayGainOptions(gain, entry.source.replayGain)) options.push_back(kv);
  // Le titre qui arrive d'une transition douce : sa courbe d'entrée, dans SA chaîne.
  if (entry.source.fadeInS && *entry.source.fadeInS > 0) options.emplace_back("af", deckChain(fadeInExpr(*entry.source.fadeInS)));
  return options;
}

std::string entryUrl(const QueueEntry& entry) {
  return entry.edlFromS ? edlFrom(entry.source.url, *entry.edlFromS) : entry.source.url;
}

std::vector<std::string> opArgs(const QueueOp& op, const std::string& mode) {
  switch (op.op) {
    case QueueOp::Kind::Load:
      return {"loadfile", entryUrl(*op.entry), modeName(op.mode), "-1", formatFileOptions(entryOptions(*op.entry, mode))};
    case QueueOp::Kind::Remove: return {"playlist-remove", std::to_string(op.index)};
    case QueueOp::Kind::SetEnd: return {"set", "file-local-options/end", fixed6(op.seconds)};
    case QueueOp::Kind::ClearEnd: return {"set", "file-local-options/end", "none"};
    case QueueOp::Kind::Seek: return {"seek", fixed6(op.seconds), "absolute+exact"};
    case QueueOp::Kind::Stop: return {"stop"};
  }
  return {"stop"};
}

std::vector<std::vector<std::string>> currentGainCommands(const EntryPtr& entry, const std::string& mode) {
  if (!entry) return {};
  std::vector<std::vector<std::string>> out;
  for (const auto& [k, v] : replayGainOptions(effectiveGainMode(mode, entry->track.albumKey, entry->neighbours), entry->source.replayGain))
    out.push_back({"set", "file-local-options/" + k, v});
  return out;
}

std::vector<std::vector<std::string>> settingCommands(const Control& c, Settings& settings, const EntryPtr& current) {
  if (c.action == "volume") {
    settings.volume = std::min(1.0, std::max(0.0, c.value));
    // Le volume de mpv est perceptuel (cubique) : 0..1 → 0..100.
    return {{"set", "volume", std::to_string(std::lround(settings.volume * 100))}};
  }
  if (c.action == "muted") {
    settings.muted = c.flag;
    return {{"set", "mute", c.flag ? "yes" : "no"}};
  }
  if (c.action == "replayGain") {
    settings.replayGain = c.mode;
    return currentGainCommands(current, c.mode);
  }
  return {};
}

std::string chainFor(bool exclusive, const std::optional<std::string>& expr) {
  if (exclusive) return "";
  return expr ? deckChain(*expr) : kLevelFilter;
}

}  // namespace tentacle::music
