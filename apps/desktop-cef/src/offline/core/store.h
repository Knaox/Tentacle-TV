#pragma once
// `files` et `claims` : la déduplication par compteur de références — `core/store.ts`.
//
// Un même média demandé par deux comptes = UN fichier et un claim par compte. Le DERNIER
// claim retiré emporte le fichier (et son `.part`) ; plus aucun fichier pour l'item, sa
// méta locale part avec lui.

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

/// Une ligne de `files`.
struct FileRow {
  int64_t id = 0;
  std::string itemId;
  std::string mediaSourceId;
  std::string variant;  // `original` | `light` (CHECK en base)
  std::optional<std::string> preset;
  std::string relPath;
  std::optional<int64_t> expectedSize;
  int64_t bytesDone = 0;
  std::string status;  // queued | downloading | paused | complete | error | canceled
  std::optional<std::string> errorCode;
  std::optional<int64_t> audioStreamIndex;
  std::optional<int64_t> burnSubtitleIndex;
  std::optional<std::string> subtitlesJson;  // INTERNE : jamais rendu à la page
  int64_t retryCount = 0;
  std::optional<int64_t> lastErrorAt;
  std::optional<int64_t> nextRetryAt;
  std::optional<std::string> phase;  // null | 'finalize' | 'prepare'
  std::optional<int64_t> subtitlesDone;
  std::optional<std::string> sourcePath;  // musique (v11) : d'où tirer le média
};

/// Colonnes de `files`, PRÉFIXÉES (les requêtes joignent `claims` et `item_meta`).
extern const char* const kFileCols;

/// Lève sur une variante ou un statut hors des valeurs du schéma (incohérence code/schéma).
FileRow mapFileRow(const Row& row);
/// Ce que la page voit d'un fichier : tout, sauf `subtitlesJson`.
Json publicFile(const FileRow& file);

template <class T>
Json opt(const std::optional<T>& value) {
  return value ? Json(*value) : Json(nullptr);
}

void setSubtitlesDone(Database& db, const std::string& itemId, const std::string& mediaSourceId, int64_t done);
void setLightParams(Database& db, int64_t fileId, const std::optional<int64_t>& audioStreamIndex,
                    const std::optional<int64_t>& burnSubtitleIndex, const std::optional<std::string>& subtitlesJson);

struct FileIdentity {
  std::string itemId;
  std::string mediaSourceId;
  std::string variant;
  std::optional<std::string> preset;
};

struct FoundFile {
  int64_t id;
  std::string status;
};
std::optional<FoundFile> findFile(Database& db, const FileIdentity& identity);

struct ClaimSpec {
  FileIdentity identity;
  std::string userId;
  std::string relPath;
  std::optional<int64_t> expectedSize;
  bool autoDeleteAfterWatch = false;
  int64_t nowMs = 0;
};
struct ClaimOutcome {
  int64_t fileId;
  bool created;  // un transfert a été créé (sinon : accroché à un existant)
};
/// S'accroche au fichier existant (un `canceled` est RÉACTIVÉ) ou le crée en file.
ClaimOutcome claimOrCreateFile(Database& db, const ClaimSpec& spec);

struct DeleteOutcome {
  bool fileDeleted = false;
  bool metaDeleted = false;
};
/// Retire le claim ; au dernier, la ligne part EN transaction puis le disque HORS
/// transaction (un échec disque laisse un orphelin rattrapable, jamais un index qui ment).
DeleteOutcome deleteClaim(Database& db, const Volume& volume, const std::string& userId, int64_t fileId);
Json toJson(const DeleteOutcome& outcome);

}  // namespace tentacle::offline
