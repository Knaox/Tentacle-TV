// Niveau (`audioLevel.ts`), ReplayGain (`replayGain.ts`), fichier qui grandit
// (`partialSource.ts`), sources (`audioSources.ts`) — règles pures d'Electron.
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>

#include "music/audio_options.h"

namespace tentacle::music {

// --- Niveau : un filtre de MESURE (astats), jamais en mode exclusif --------------------
const char* const kLevelLabel = "octave-level";
const std::string kLevelFilter =
    std::string("@") + kLevelLabel +
    ":lavfi=[astats=metadata=1:reset=2:measure_perchannel=none:measure_overall=RMS_level]";
const std::string kLevelProperty = std::string("af-metadata/") + kLevelLabel + "/lavfi.astats.Overall.RMS_level";

std::optional<double> parseLevel(const std::optional<std::string>& raw) {
  if (!raw) return std::nullopt;
  std::string text = *raw;
  text.erase(0, text.find_first_not_of(" \t\r\n"));
  text.erase(text.find_last_not_of(" \t\r\n") + 1);
  std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) { return std::tolower(c); });
  if (text == "-inf") return kSilenceDb;
  if (text.empty()) return std::nullopt;
  char* end = nullptr;
  const double v = std::strtod(text.c_str(), &end);
  if (end == text.c_str() || *end != '\0' || !std::isfinite(v)) return std::nullopt;
  return std::min(0.0, std::max(kSilenceDb, v));
}

// --- ReplayGain : « auto » = l'album quand un voisin est du même album ------------------
std::string effectiveGainMode(const std::string& mode, const std::optional<std::string>& albumKey,
                              const std::vector<std::optional<std::string>>& neighbours) {
  if (mode != "auto") return mode;
  if (!albumKey) return "track";
  for (const auto& k : neighbours)
    if (k && *k == *albumKey) return "album";
  return "track";
}

std::optional<double> gainFromSource(const std::string& mode, const ReplayGainValues& rg) {
  const bool album = mode == "album";
  const auto gain = album ? (rg.albumGainDb ? rg.albumGainDb : rg.trackGainDb) : (rg.trackGainDb ? rg.trackGainDb : rg.albumGainDb);
  if (!gain || !std::isfinite(*gain)) return std::nullopt;
  const auto peak = album ? (rg.albumPeak ? rg.albumPeak : rg.trackPeak) : (rg.trackPeak ? rg.trackPeak : rg.albumPeak);
  double db = *gain;
  // Crête × gain ≤ 1 : le gain se rabat là où le titre écrêterait.
  if (peak && std::isfinite(*peak) && *peak > 0) db = std::min(db, -20 * std::log10(*peak));
  return std::min(12.0, std::max(-30.0, db));
}

Options replayGainOptions(const std::string& mode, const std::optional<ReplayGainValues>& rg) {
  if (mode == "off") return {{"replaygain", "no"}, {"volume-gain", "0"}};
  if (const auto db = rg ? gainFromSource(mode, *rg) : std::nullopt) {
    char buf[32];
    std::snprintf(buf, sizeof buf, "%.2f", *db);
    return {{"replaygain", "no"}, {"volume-gain", buf}};
  }
  return {{"replaygain", mode}, {"volume-gain", "0"}};
}

// --- Fichier qui grandit ---------------------------------------------------------------
bool isRealEnd(const EndContext& ctx) {
  if (ctx.complete) return true;
  if (ctx.durationMs && *ctx.durationMs > 0) {
    if (ctx.positionMs >= *ctx.durationMs - kPartialEndToleranceMs) return true;
    // Une durée annoncée qui ne vient jamais (fichier tronqué) : on ne relit pas éternellement.
    return ctx.stalledReloads >= kMaxStalledReloads * 2;
  }
  return ctx.stalledReloads >= kMaxStalledReloads;
}

bool cachedToEnd(std::optional<double> cacheTimeS, double offsetS, std::optional<double> durationMs) {
  if (!cacheTimeS || !durationMs || *durationMs <= 0) return false;
  return (*cacheTimeS + offsetS) * 1000 >= *durationMs - 250;
}

int reloadDelayMs(int attempt) {
  static constexpr int kDelays[] = {250, 600, 1200, 2500};
  return kDelays[std::clamp(attempt, 0, 3)];
}

bool progressed(std::optional<double> previousMs, double positionMs) {
  return !previousMs || positionMs > *previousMs + 200;
}

// --- Sources : le serveur Tentacle seul, en http(s) ------------------------------------
std::optional<std::string> httpOrigin(const std::string& raw) {
  const auto scheme = raw.find("://");
  if (scheme == std::string::npos) return std::nullopt;
  std::string proto = raw.substr(0, scheme);
  std::transform(proto.begin(), proto.end(), proto.begin(), [](unsigned char c) { return std::tolower(c); });
  if (proto != "http" && proto != "https") return std::nullopt;
  const size_t start = scheme + 3;
  const size_t end = raw.find_first_of("/?#", start);
  std::string authority = raw.substr(start, end == std::string::npos ? std::string::npos : end - start);
  // Des identifiants dans l'adresse (`u:p@hôte`) : refusés, comme `new URL()` d'Electron.
  if (authority.empty() || authority.find('@') != std::string::npos) return std::nullopt;
  std::transform(authority.begin(), authority.end(), authority.begin(), [](unsigned char c) { return std::tolower(c); });
  // Le port par défaut ne fait pas partie de l'origine (`URL.origin`).
  const std::string defaultPort = proto == "http" ? ":80" : ":443";
  if (authority.size() > defaultPort.size() && authority.ends_with(defaultPort) && authority.back() != ']')
    authority.resize(authority.size() - defaultPort.size());
  return proto + "://" + authority;
}

std::optional<std::string> refuseSource(const std::string& url, const std::optional<std::string>& serverOrigin) {
  if (!serverOrigin) return "moteur audio non démarré";
  const auto origin = httpOrigin(url);
  if (!origin) return "source refusée : seulement http(s)";
  if (origin != httpOrigin(*serverOrigin)) return "source refusée : hors du serveur Tentacle";
  return std::nullopt;
}

bool expiresSoon(const Source& source, double nowMs, double marginMs) {
  return source.expiresAt && *source.expiresAt - nowMs < marginMs;
}

Source servedSource(std::map<std::string, Source>& overrides, const std::string& trackKey, const Source& given) {
  auto it = overrides.find(trackKey);
  if (it == overrides.end()) return given;
  Source override = std::move(it->second);
  overrides.erase(it);
  // Une bascule reçue d'avance l'emporte, sauf à reculer de la bibliothèque vers l'extension.
  return override.origin == "library" || given.origin != "library" ? override : given;
}

}  // namespace tentacle::music
