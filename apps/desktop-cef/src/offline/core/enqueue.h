#pragma once
// Mise en file d'un lot : un film seul, ou une saison entière — `core/enqueue.ts`.
//
// Le refus est GLOBAL : si l'espace libre (marge de 2 Gio comprise) ne couvre pas le lot plus
// les transferts déjà promis, rien n'est mis en file.

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"
#include "offline/core/subs.h"

namespace tentacle::offline {

using Json = nlohmann::json;

struct EnqueueItem {
  std::string itemId, mediaSourceId, variant;
  std::optional<std::string> preset;
  std::string containerExt;
  std::optional<int64_t> expectedSize;   // EXACTE (Original) : contrôle d'intégrité final
  std::optional<int64_t> estimatedSize;  // Allégé : durée × débit × 1,15
  std::string kind;                      // movie | episode
  std::optional<std::string> seriesId, seasonId, libraryId;
  std::optional<int64_t> runtimeTicks;
  std::optional<std::string> title, seriesName;
  std::optional<int64_t> indexNumber, parentIndexNumber;
  bool autoDeleteAfterWatch = false;
  int64_t autoDeleteDelayMinutes = 0;
  std::optional<int64_t> audioStreamIndex, burnSubtitleIndex;
  std::optional<std::vector<SubtitleSpec>> subtitles;
};

/// Un item tel que la page le décrit (schéma `ITEM` de `ipc/downloadsEngine.ts`), normalisé.
/// Lève `args::Invalid` sur une forme refusée.
EnqueueItem enqueueItemFromJson(const Json& item);

/// Lève `empty-batch` ou `invalid-item` (codes STABLES) : ces identifiants finissent dans
/// des NOMS DE FICHIERS.
void validateBatch(const std::vector<EnqueueItem>& items);
/// Chemin relatif du média, figé (le changer rendrait l'existant invisible).
std::string mediaRelPath(const EnqueueItem& item);

/// `{accepted, neededBytes, freeBytes, fileIds}`.
Json enqueueBatch(Database& db, const std::string& userId, const std::vector<EnqueueItem>& items, int64_t freeBytes,
                  int64_t nowMs, int64_t margin = kCapacityMarginBytes);

/// Numéros d'épisode : depuis un DTO (`apply`), ou depuis les `item.json` du disque, sans
/// réseau (`backfill`, une fois par session à la première liste) — `episodeNumbers.ts`.
bool applyEpisodeNumbers(Database& db, const std::string& itemId, const std::vector<uint8_t>& itemJson);
int64_t backfillEpisodeNumbers(Database& db, const Volume& volume);

}  // namespace tentacle::offline
