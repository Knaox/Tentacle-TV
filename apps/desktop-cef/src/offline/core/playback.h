#pragma once
// Lecture locale, progression, file de resynchronisation, purge des vus — `core/playback.ts`,
// `core/fileLookup.ts`, `core/purge.ts` et `diskUsage` (`core/usage.ts`).

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"
#include "offline/core/store.h"

namespace tentacle::offline {

using Json = nlohmann::json;

/// Meilleur fichier COMPLET de ce compte pour cet item (Original avant Allégé).
std::optional<FileRow> completeFileForItem(Database& db, const std::string& userId, const std::string& itemId);
/// `mediaSourceId` le plus récent de l'item (clé du manifeste trickplay).
std::optional<std::string> firstMediaSourceId(Database& db, const std::string& itemId);

/// La source LISIBLE (fichier revérifié à chaque lecture : présent, taille exacte pour
/// l'Original), ou `null` — et le fichier passe alors en défaut (`missing`, `integrity`).
/// `absolutePath` : le chemin ABSOLU, passé tel quel à mpv.
Json localSource(Database& db, const Volume& volume, const std::string& userId, const std::string& itemId,
                 int64_t nowMs);
/// Chemin absolu seul (la musique gardée, `audioKept.ts`).
std::optional<std::string> localSourcePath(Database& db, const Volume& volume, const std::string& userId,
                                           const std::string& itemId, int64_t nowMs);

/// `played` ne redescend JAMAIS par cette voie (`MAX`) ; `queueForSync` = lecture hors ligne.
void setPlaybackState(Database& db, const std::string& userId, const std::string& itemId, const Json& positionTicks,
                      bool played, bool queueForSync, int64_t nowMs);
/// Recommencer un item vu : progression à zéro, échéance de suppression annulée.
void restartPlayback(Database& db, const std::string& userId, const std::string& itemId, int64_t nowMs);
/// Un rapport par item, le plus récent, à pousser vers Jellyfin.
Json pendingReports(Database& db, const std::string& userId);
void markItemSynced(Database& db, const std::string& userId, const std::string& itemId, int64_t upToId);

/// Pose l'échéance quand l'item passe « vu » (idempotent).
void scheduleOnPlayed(Database& db, const std::string& userId, const std::string& itemId, int64_t nowMs);
/// Supprime les claims échus, tous comptes ; saute une lecture en cours (battement < 60 s),
/// sauf `exemptItem`. Rend le nombre de CLAIMS retirés.
int64_t purgeDueClaims(Database& db, const Volume& volume, int64_t nowMs, const std::optional<std::string>& exemptItem,
                       const std::optional<std::string>& protectedItem = std::nullopt);

/// Octets occupés par TOUS les fichiers, partiels compris (lu en base).
int64_t diskUsage(Database& db);

}  // namespace tentacle::offline
