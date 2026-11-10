// Options de l'instance mpv AUDIO SEUL et de chaque fichier — `audioOptions.ts` d'Electron.
#include "music/audio_options.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string_view>

namespace tentacle::music {
namespace {

bool allOf(const std::string& s, std::string_view allowed) {
  for (unsigned char c : s)
    if (!std::isalnum(c) && allowed.find(static_cast<char>(c)) == std::string_view::npos) return false;
  return true;
}

}  // namespace

Platform currentPlatform() {
#if defined(__APPLE__)
  return Platform::Darwin;
#elif defined(_WIN32)
  return Platform::Win32;
#else
  return Platform::Linux;
#endif
}

void setOption(Options& options, const std::string& key, const std::string& value) {
  for (auto& [k, v] : options)
    if (k == key) return void(v = value);
  options.emplace_back(key, value);
}

const std::string* findOption(const Options& options, const std::string& key) {
  for (const auto& [k, v] : options)
    if (k == key) return &v;
  return nullptr;
}

bool forcedSilence() {
  // La même variable que le lecteur vidéo (`player/sound_policy.h`), lue ici sans en
  // dépendre : le banc de la musique se construit aussi sans `tentacle_player`.
  const char* v = std::getenv("TENTACLE_MUTE");
  return v && *v && std::string_view(v) != "0";
}

std::string fixed6(double s) {
  char buf[48];
  std::snprintf(buf, sizeof buf, "%.6f", s);
  return buf;
}

Options audioInstanceOptions() {
  return {
      {"vo", "null"}, {"vid", "no"}, {"video", "no"}, {"audio-display", "no"}, {"idle", "yes"},
      // Le dernier titre s'arrête en pause sur sa fin : le moteur a le temps de dire « fini ».
      {"keep-open", "yes"},
      // `weak`, jamais `yes` : `yes` rééchantillonne tout au format du premier titre.
      {"gapless-audio", "weak"}, {"prefetch-playlist", "yes"},
      {"sid", "no"}, {"audio-file-auto", "no"}, {"cover-art-auto", "no"},
      {"cache", "yes"}, {"demuxer-max-bytes", "48MiB"}, {"demuxer-max-back-bytes", "16MiB"},
      {"demuxer-readahead-secs", "20"}, {"cache-pause-initial", "no"}, {"cache-pause-wait", "0.5"},
      {"network-timeout", "15"}, {"volume-max", "100"}, {"replaygain-clip", "yes"},
      {"input-default-bindings", "no"}, {"input-vo-keyboard", "no"}, {"terminal", "no"}, {"msg-level", "all=warn"},
      // `mpvNoScripts.ts` : aucun script de mpv, jamais.
      {"load-scripts", "no"}, {"scripts", ""}, {"load-auto-profiles", "no"}, {"load-osd-console", "no"},
      {"load-stats-overlay", "no"}, {"load-select", "no"}, {"load-positioning", "no"}, {"load-commands", "no"},
      {"ytdl", "no"}, {"osc", "no"},
      // Propres à CEF : aucune configuration de l'utilisateur, aucune fenêtre ; le nom de la
      // session audio (mélangeur de Windows, PipeWire).
      {"config", "no"}, {"force-window", "no"}, {"audio-client-name", "Tentacle"},
  };
}

Options outputOptions(Platform platform, const std::optional<std::string>& deviceId, bool exclusive) {
  Options o = {{"audio-device", deviceId.value_or("auto")}, {"audio-exclusive", exclusive ? "yes" : "no"}};
  // macOS : le format PHYSIQUE du périphérique suit le titre en mode exclusif.
  if (platform == Platform::Darwin) o.emplace_back("coreaudio-change-physical-format", exclusive ? "yes" : "no");
  return o;
}

Options partialStreamOptions(bool complete) {
  if (complete) return {};
  // ⚠️ Jamais `reconnect_at_eof` (boucle aussi sur la VRAIE fin : 24 s d'enlisement mesurés).
  return {{"stream-lavf-o", "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=2"}};
}

std::string formatFileOptions(const Options& options) {
  std::string out;
  for (const auto& [key, value] : options) {
    if (key.empty() || !allOf(key, "-/")) {
      std::fprintf(stderr, "[music] option par fichier invalide ignorée : %s\n", key.c_str());
      continue;
    }
    if (!out.empty()) out += ",";
    // La longueur en OCTETS (UTF-8) : `std::string::size()`.
    out += allOf(value, "._+-:/") ? key + "=" + value : key + "=%" + std::to_string(value.size()) + "%" + value;
  }
  return out;
}

std::string edlFrom(const std::string& url, double fromS) {
  // La longueur, large : sans elle mpv perd le DERNIER échantillon du titre (mesuré).
  return "edl://%" + std::to_string(url.size()) + "%" + url + ",start=" + fixed6(fromS) + ",length=86400";
}

double swapPoint(double positionS, std::optional<double> sampleRate, double leadS) {
  const double target = positionS + leadS;
  if (!sampleRate || *sampleRate <= 0) return target;
  // AU MILIEU de deux échantillons : `end` et `start` ne se recouvrent jamais (bit pour bit).
  return (std::floor(target * *sampleRate) + 0.5) / *sampleRate;
}

Options levelFilterOption(bool exclusive) {
  if (exclusive) return {};
  return {{"af", kLevelFilter}};
}

Options startOptions(Platform platform, const StartSettings& start, const Options& extra) {
  Options o = audioInstanceOptions();
  for (const auto& [k, v] : outputOptions(platform, start.deviceId, start.exclusive)) setOption(o, k, v);
  const bool silent = forcedSilence();
  const long vol = std::lround(std::fmin(1.0, std::fmax(0.0, start.volume)) * 100);
  setOption(o, "volume", silent ? "0" : std::to_string(vol));
  setOption(o, "mute", silent || start.muted ? "yes" : "no");
  for (const auto& [k, v] : levelFilterOption(start.exclusive)) setOption(o, k, v);
  for (const auto& [k, v] : extra) setOption(o, k, v);
  return o;
}

std::optional<std::string> headerLines(const std::map<std::string, std::string>& headers, std::vector<std::string>& out) {
  for (const auto& [name, value] : headers) {
    if (name.empty() || !allOf(name, "-")) return "en-tête invalide : " + name;
    if (value.find_first_of("\r\n") != std::string::npos) return "valeur d'en-tête invalide pour " + name;
    out.push_back(name + ": " + value);
  }
  return std::nullopt;
}

}  // namespace tentacle::music
