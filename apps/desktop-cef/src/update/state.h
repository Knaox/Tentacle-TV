#pragma once
// Ce que l'appareil retient entre deux lancements (un fichier JSON par profil). Écriture
// atomique (fichier temporaire puis rename) : une coupure ne laisse jamais un état à moitié.

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::update {

struct DeviceState {
  // « Ne plus m'avertir jusqu'à la prochaine grosse mise à jour » : toute majeure jusqu'à
  // cette version comprise se tait ; la majeure suivante (plus récente) parle de nouveau.
  std::string mutedThrough;
  // « Plus tard » : la notification de cette majeure attend jusqu'à `snoozedUntil`.
  std::string snoozedVersion;
  int64_t snoozedUntil = 0;
  // Versions revenues en arrière sur CET appareil : jamais reproposées en silence.
  std::vector<std::string> badVersions;
  // `issuedAt` du dernier manifeste accepté : un manifeste plus ancien (rejoué pour cacher
  // une mise à jour de sécurité) est refusé.
  int64_t lastIssuedAt = 0;
};

// Période d'essai d'une version fraîchement installée (fichier à part : l'assistant de
// remplacement l'écrit pendant que l'app est fermée).
struct Probation {
  std::string version;       // la nouvelle version
  std::string previousPath;  // l'ancienne copie, gardée pour revenir en arrière
  std::string appPath;       // l'emplacement de l'app
  int launches = 0;          // lancements sans « bonne santé »
  bool healthy = false;
  std::string rolledBack;    // version abandonnée par un retour arrière (à reporter)
};

std::optional<DeviceState> loadState(const std::string& path);
bool saveState(const std::string& path, const DeviceState& s);
std::optional<Probation> loadProbation(const std::string& path);
bool saveProbation(const std::string& path, const Probation& p);

// Écrit `content` dans `path` par un fichier voisin puis rename (atomique sur un volume).
bool writeFileAtomic(const std::string& path, const std::string& content);
std::optional<std::string> readFile(const std::string& path, size_t maxBytes = 1 << 20);

}  // namespace tentacle::update
