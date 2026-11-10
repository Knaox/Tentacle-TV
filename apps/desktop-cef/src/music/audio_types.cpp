#include "music/audio_types.h"

#include <cmath>

namespace tentacle::music {
namespace {

using json = nlohmann::json;

// Un champ absent vaut `null` (le front envoie toujours ces clés) ; un mauvais type, jamais.
bool optNumber(const json& j, const char* key, std::optional<double>& out, bool nonNegative = false) {
  auto it = j.find(key);
  if (it == j.end() || it->is_null()) return (out = std::nullopt, true);
  if (!it->is_number() || !std::isfinite(it->get<double>())) return false;
  if (nonNegative && it->get<double>() < 0) return false;
  out = it->get<double>();
  return true;
}

bool optString(const json& j, const char* key, std::optional<std::string>& out, size_t maxLen, size_t minLen = 0) {
  auto it = j.find(key);
  if (it == j.end() || it->is_null()) return (out = std::nullopt, true);
  if (!it->is_string()) return false;
  const auto& s = it->get_ref<const std::string&>();
  if (s.size() > maxLen || s.size() < minLen) return false;
  out = s;
  return true;
}

bool key(const json& j, const char* name, std::string& out) {
  auto it = j.find(name);
  if (it == j.end() || !it->is_string()) return false;
  out = it->get<std::string>();
  return !out.empty() && out.size() <= 512;
}

template <typename T>
json orNull(const std::optional<T>& v) {
  return v ? json(*v) : json(nullptr);
}

}  // namespace

bool validReplayGainMode(const std::string& m) { return m == "off" || m == "track" || m == "album" || m == "auto"; }

std::optional<AudioFormat> parseFormat(const json& j) {
  if (!j.is_object() || !j.contains("codec") || !j["codec"].is_string()) return std::nullopt;
  AudioFormat f;
  f.codec = j["codec"].get<std::string>();
  if (f.codec.size() > 32) return std::nullopt;
  if (!optString(j, "container", f.container, 128) || !optNumber(j, "sampleRate", f.sampleRate) ||
      !optNumber(j, "bitDepth", f.bitDepth) || !optNumber(j, "bitrate", f.bitrate) || !optNumber(j, "channels", f.channels))
    return std::nullopt;
  f.lossless = j.value("lossless", false);
  return f;
}

std::optional<std::string> parseTrack(const json& j, Track& out) {
  if (!j.is_object()) return "track: objet attendu";
  if (!key(j, "trackKey", out.trackKey)) return "track.trackKey invalide";
  if (!optString(j, "albumKey", out.albumKey, 512, 1)) return "track.albumKey invalide";
  if (!optNumber(j, "durationMs", out.durationMs, true)) return "track.durationMs invalide";
  out.format = std::nullopt;
  if (j.contains("format") && !j["format"].is_null()) {
    out.format = parseFormat(j["format"]);
    if (!out.format) return "track.format invalide";
  }
  return std::nullopt;
}

std::optional<std::string> parseSource(const json& j, Source& out) {
  if (!j.is_object()) return "source: objet attendu";
  out = Source{};
  auto url = j.find("url");
  if (url == j.end() || !url->is_string() || url->get_ref<const std::string&>().empty() ||
      url->get_ref<const std::string&>().size() > 4096)
    return "source.url invalide";
  out.url = url->get<std::string>();
  out.origin = j.value("origin", std::string("library"));
  if (out.origin != "library" && out.origin != "plugin") return "source.origin invalide";
  if (j.contains("complete") && !j["complete"].is_boolean()) return "source.complete invalide";
  out.complete = j.value("complete", true);
  if (!optNumber(j, "sizeBytes", out.sizeBytes, true) || !optNumber(j, "durationMs", out.durationMs, true) ||
      !optNumber(j, "expiresAt", out.expiresAt))
    return "source : nombre invalide";
  if (j.contains("replayGain") && j["replayGain"].is_object()) {
    const json& g = j["replayGain"];
    ReplayGainValues rg;
    if (!optNumber(g, "trackGainDb", rg.trackGainDb) || !optNumber(g, "trackPeak", rg.trackPeak) ||
        !optNumber(g, "albumGainDb", rg.albumGainDb) || !optNumber(g, "albumPeak", rg.albumPeak))
      return "source.replayGain invalide";
    out.replayGain = rg;
  } else if (j.contains("replayGain") && !j["replayGain"].is_null()) {
    return "source.replayGain invalide";
  }
  if (j.contains("direct") && j["direct"].is_object()) {
    const json& d = j["direct"];
    DirectStream ds;
    if (!d.contains("url") || !d["url"].is_string() || d["url"].get_ref<const std::string&>().empty() ||
        d["url"].get_ref<const std::string&>().size() > 8192 || !optNumber(d, "expiresAt", ds.expiresAt))
      return "source.direct invalide";
    ds.url = d["url"].get<std::string>();
    out.direct = ds;
  }
  if (j.contains("kept") && j["kept"].is_object()) {
    const json& k = j["kept"];
    KeptRef kr;
    std::optional<std::string> user;
    if (!optString(k, "userId", user, 128, 1) || !user || !optString(k, "trackKey", kr.trackKey, 512, 1))
      return "source.kept invalide";
    kr.userId = *user;
    out.kept = kr;
  }
  return std::nullopt;
}

std::optional<std::string> parseStart(const json& j, StartSettings& out) {
  if (!j.is_object()) return "arguments invalides";
  std::optional<std::string> origin;
  if (!optString(j, "serverOrigin", origin, 2048, 1) || !origin) return "serverOrigin attendu";
  out.serverOrigin = *origin;
  out.headers.clear();
  if (j.contains("headers")) {
    if (!j["headers"].is_object()) return "headers invalides";
    for (const auto& [k, v] : j["headers"].items()) {
      if (!v.is_string() || v.get_ref<const std::string&>().size() > 4096) return "headers invalides";
      out.headers[k] = v.get<std::string>();
    }
  }
  const json vol = j.value("volume", json(1.0));
  if (!vol.is_number() || vol.get<double>() < 0 || vol.get<double>() > 1) return "volume invalide";
  out.volume = vol.get<double>();
  out.muted = j.value("muted", false);
  out.replayGain = j.value("replayGain", std::string("auto"));
  if (!validReplayGainMode(out.replayGain)) return "replayGain invalide";
  if (!optString(j, "deviceId", out.deviceId, 512)) return "deviceId invalide";
  out.exclusive = j.value("exclusive", false);
  return std::nullopt;
}

std::optional<std::string> parseControl(const json& j, Control& out) {
  if (!j.is_object() || !j.contains("action") || !j["action"].is_string()) return "action attendue";
  out = Control{};
  out.action = j["action"].get<std::string>();
  const auto& a = out.action;
  if (a == "pause" || a == "resume" || a == "stop") return std::nullopt;
  if (a == "replayGain") {
    out.mode = j.value("mode", std::string());
    return validReplayGainMode(out.mode) ? std::nullopt : std::optional<std::string>("replayGain : mode invalide");
  }
  if (a == "muted") {
    if (!j.contains("value") || !j["value"].is_boolean()) return "muted : value booléen attendu";
    out.flag = j["value"].get<bool>();
    return std::nullopt;
  }
  if (!j.contains("value") || !j["value"].is_number() || !std::isfinite(j["value"].get<double>()))
    return a + " : value attendu";
  out.value = j["value"].get<double>();
  if (a == "seek") return out.value >= 0 ? std::nullopt : std::optional<std::string>("seek : value >= 0");
  if (a == "volume") return out.value >= 0 && out.value <= 1 ? std::nullopt : std::optional<std::string>("volume : 0..1");
  if (a == "crossfade") return out.value >= 0 && out.value <= 12000 ? std::nullopt : std::optional<std::string>("crossfade : 0..12000");
  return "action inconnue : " + a;
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
          {"output", {{"deviceId", orNull(s.deviceId)}, {"exclusive", s.exclusive}}},
          {"error", orNull(s.error)}};
}

json toJson(const Source& s) {
  json j = {{"url", s.url},
            {"origin", s.origin},
            {"complete", s.complete},
            {"sizeBytes", orNull(s.sizeBytes)},
            {"durationMs", orNull(s.durationMs)},
            {"replayGain", nullptr},
            {"expiresAt", orNull(s.expiresAt)}};
  if (s.replayGain)
    j["replayGain"] = {{"trackGainDb", orNull(s.replayGain->trackGainDb)}, {"trackPeak", orNull(s.replayGain->trackPeak)},
                       {"albumGainDb", orNull(s.replayGain->albumGainDb)}, {"albumPeak", orNull(s.replayGain->albumPeak)}};
  if (s.direct) j["direct"] = {{"url", s.direct->url}, {"expiresAt", orNull(s.direct->expiresAt)}};
  if (s.kept) {
    j["kept"] = {{"userId", s.kept->userId}};
    if (s.kept->trackKey) j["kept"]["trackKey"] = *s.kept->trackKey;
  }
  return j;
}

json toJson(const Control& c) {
  json j = {{"action", c.action}};
  if (c.action == "muted") j["value"] = c.flag;
  else if (c.action == "replayGain") j["mode"] = c.mode;
  else if (c.action != "pause" && c.action != "resume" && c.action != "stop") j["value"] = c.value;
  return j;
}

}  // namespace tentacle::music
