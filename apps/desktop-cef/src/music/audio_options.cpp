#include "music/audio_options.h"

#include <cmath>
#include <cstdlib>
#include <string_view>

namespace tentacle::music {

bool forcedSilence() {
  // La même variable que le lecteur vidéo (`player/sound_policy.h`), lue ici sans en
  // dépendre : le banc de la musique se construit aussi sans `tentacle_player`.
  const char* v = std::getenv("TENTACLE_MUTE");
  return v && *v && std::string_view(v) != "0";
}

Options instanceOptions(const StartSettings& start, const Options& extra) {
  Options o = {
      // Rien d'autre que le son : aucune sortie vidéo, aucune piste vidéo, et
      // une pochette EMBARQUÉE ne devient jamais une « vidéo » (référence
      // jellium c5ad000 : avec `vid=1`, chaque titre à pochette finissait à ~1 s).
      {"vo", "null"},
      {"vid", "no"},
      {"video", "no"},
      {"audio-display", "no"},
      {"force-window", "no"},
      {"idle", "yes"},
      // Le dernier titre s'arrête en pause sur sa fin : le moteur dit « fini ».
      {"keep-open", "yes"},
      // `weak` : sans blanc tant que le format ne change pas ; `yes`
      // rééchantillonnerait tout au format du premier titre.
      {"gapless-audio", "weak"},
      {"prefetch-playlist", "yes"},
      {"sid", "no"},
      {"audio-file-auto", "no"},
      {"cover-art-auto", "no"},
      {"cache", "yes"},
      {"demuxer-max-bytes", "48MiB"},
      {"demuxer-max-back-bytes", "16MiB"},
      {"demuxer-readahead-secs", "20"},
      {"cache-pause-initial", "no"},
      {"cache-pause-wait", "0.5"},
      {"network-timeout", "15"},
      {"volume-max", "100"},
      {"replaygain", start.replayGain == "off" ? "no" : (start.replayGain == "album" ? "album" : "track")},
      {"replaygain-clip", "yes"},
      {"input-default-bindings", "no"},
      {"input-vo-keyboard", "no"},
      {"load-scripts", "no"},
      {"config", "no"},
      {"terminal", "no"},
      {"audio-client-name", "Tentacle"},
      {"audio-device", start.deviceId.value_or("auto")},
      {"audio-exclusive", "no"},
  };
  const bool silent = forcedSilence();
  long vol = std::lround(std::fmin(1.0, std::fmax(0.0, start.volume)) * 100);
  o.emplace_back("volume", silent ? "0" : std::to_string(vol));
  o.emplace_back("mute", silent || start.muted ? "yes" : "no");
  for (const auto& kv : extra) o.push_back(kv);
  return o;
}

std::optional<std::string> headerLines(const std::map<std::string, std::string>& headers,
                                       std::vector<std::string>& out) {
  for (const auto& [name, value] : headers) {
    if (name.empty() || name.find_first_not_of(
                            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-") != std::string::npos)
      return "en-tete invalide : " + name;
    if (value.find_first_of("\r\n") != std::string::npos) return "valeur d'en-tete invalide pour " + name;
    out.push_back(name + ": " + value);
  }
  return std::nullopt;
}

std::string fileOptions(const std::vector<std::pair<std::string, std::string>>& options) {
  std::string s;
  for (const auto& [k, v] : options) {
    if (!s.empty()) s += ",";
    s += k + "=%" + std::to_string(v.size()) + "%" + v;
  }
  return s;
}

std::optional<std::string> refuseSource(const std::string& url, const std::string& serverOrigin) {
  if (serverOrigin.empty()) return "moteur non demarre";
  if (url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) return "source refusee (schema) : " + url;
  // L'origine exacte, suivie d'un chemin : `http://hote:port/…`, jamais `…:port.autre/…`.
  if (url.rfind(serverOrigin, 0) != 0) return "source hors du serveur : " + url;
  if (url.size() > serverOrigin.size() && url[serverOrigin.size()] != '/') return "source hors du serveur : " + url;
  return std::nullopt;
}

}  // namespace tentacle::music
