// Octave — les options de l'instance mpv AUDIO SEUL (reprises de Tentacle,
// `apps/desktop-electron/src/main/audio/audioOptions.ts`, le POURQUOI y est).
#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "music/audio_backend.h"

namespace tentacle::music {

struct StartSettings {
  std::string serverOrigin;
  std::map<std::string, std::string> headers;
  double volume = 1.0;
  bool muted = false;
  std::string replayGain = "auto";
  std::optional<std::string> deviceId;
  bool exclusive = false;
};

// Mode muet des bancs (`--mute` / `TENTACLE_MUTE=1`) : l'instance naît `mute=yes`,
// volume 0, et n'en sort jamais. Sinon, le volume et la sourdine de la page, comme
// sous Electron. L'état rendu à la page garde, lui, ce que la page a demandé.
bool forcedSilence();

// Options posées avant `mpv_initialize`.
Options instanceOptions(const StartSettings& start, const Options& extra);

// Les en-têtes HTTP, un par élément (`change-list http-header-fields append`) : une
// virgule ne coupe donc plus la valeur (`Authorization: MediaBrowser a="…", Token="…"`).
// Rend une erreur si un nom ou une valeur porte un retour à la ligne.
std::optional<std::string> headerLines(const std::map<std::string, std::string>& headers,
                                       std::vector<std::string>& out);

// Options par fichier de `loadfile` (`clé=valeur,…`), valeurs en `%n%valeur`.
std::string fileOptions(const std::vector<std::pair<std::string, std::string>>& options);

// L'adresse vient-elle du serveur réglé au démarrage ? (`refuseSource` de Tentacle.)
std::optional<std::string> refuseSource(const std::string& url, const std::string& serverOrigin);

}  // namespace tentacle::music
