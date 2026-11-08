#include "music/audio_types.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

std::optional<double> optNumber(const json& j, const char* key) {
  auto it = j.find(key);
  if (it == j.end() || !it->is_number()) return std::nullopt;
  return it->get<double>();
}

std::optional<std::string> optString(const json& j, const char* key) {
  auto it = j.find(key);
  if (it == j.end() || !it->is_string()) return std::nullopt;
  return it->get<std::string>();
}

template <typename T>
json orNull(const std::optional<T>& v) {
  return v ? json(*v) : json(nullptr);
}

}  // namespace

bool isLossless(const std::string& codec) {
  return codec == "flac" || codec == "alac" || codec == "wavpack" || codec == "ape" || codec == "tta" ||
         codec.rfind("pcm_", 0) == 0;
}

std::optional<AudioFormat> parseFormat(const json& j) {
  if (!j.is_object() || !j.contains("codec") || !j["codec"].is_string()) return std::nullopt;
  AudioFormat f;
  f.codec = j["codec"].get<std::string>();
  f.container = optString(j, "container");
  f.sampleRate = optNumber(j, "sampleRate");
  f.bitDepth = optNumber(j, "bitDepth");
  f.bitrate = optNumber(j, "bitrate");
  f.channels = optNumber(j, "channels");
  f.lossless = j.value("lossless", false);
  return f;
}

std::optional<std::string> parseTrack(const json& j, Track& out) {
  if (!j.is_object()) return "track: objet attendu";
  auto key = optString(j, "trackKey");
  if (!key || key->empty() || key->size() > 512) return "track.trackKey invalide";
  out.trackKey = *key;
  out.albumKey = optString(j, "albumKey");
  out.durationMs = optNumber(j, "durationMs");
  out.format = j.contains("format") ? parseFormat(j["format"]) : std::nullopt;
  return std::nullopt;
}

std::optional<std::string> parseSource(const json& j, Source& out) {
  if (!j.is_object()) return "source: objet attendu";
  auto url = optString(j, "url");
  if (!url || url->empty() || url->size() > 4096) return "source.url invalide";
  out.url = *url;
  out.origin = optString(j, "origin").value_or("library");
  if (out.origin != "library" && out.origin != "plugin") return "source.origin invalide";
  out.complete = j.value("complete", true);
  out.durationMs = optNumber(j, "durationMs");
  return std::nullopt;
}

json toJson(const AudioFormat& f) {
  return {{"codec", f.codec},         {"container", orNull(f.container)}, {"sampleRate", orNull(f.sampleRate)},
          {"bitDepth", orNull(f.bitDepth)}, {"bitrate", orNull(f.bitrate)},     {"channels", orNull(f.channels)},
          {"lossless", f.lossless}};
}

json toJson(const BridgeState& s) {
  return {{"status", s.status},
          {"trackKey", orNull(s.trackKey)},
          {"positionMs", s.positionMs},
          {"durationMs", orNull(s.durationMs)},
          {"volume", s.volume},
          {"muted", s.muted},
          {"format", s.format ? toJson(*s.format) : json(nullptr)},
          {"output", {{"deviceId", orNull(s.deviceId)}, {"exclusive", false}}},
          {"error", orNull(s.error)}};
}

}  // namespace tentacle::music
