#pragma once
// Rapprochement de l'état de visionnage — `core/reconcile.ts` (`applyServerUserData`).
//
// Ce que le serveur sait d'un titre gardé (vu, position, date), lu par la PAGE, confronté à
// la progression locale. Dernier écrivain gagne, par date ; un « vu » sans date n'entre que
// si l'appareil n'en sait rien ; un « marqué non vu » n'est suivi que si aucun rapport
// n'attend en file pour ce titre. Jamais de ligne de file créée ici.

#include <cstdint>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

struct ServerUserData {
  std::string itemId;
  bool played = false;
  int64_t positionTicks = 0;
  /// `LastPlayedDate` en millisecondes ; rien = jamais vu (ou dé-marqué).
  std::optional<int64_t> lastPlayedAtMs;
};

/// La charge de `downloads_playback_reconcile` : `[{ itemId, played, positionTicks,
/// lastPlayedAtMs }]`. Lève `args::Invalid` sur une forme inattendue.
std::vector<ServerUserData> parseServerUserData(const Json& entries);
/// `pendingItemIds` : une liste de chaînes non vides.
std::set<std::string> parseItemIds(const Json& ids);

/// Applique l'état serveur quand il est plus récent que le local ; rend les items modifiés.
std::vector<std::string> applyServerUserData(Database& db, const std::string& userId,
                                             const std::vector<ServerUserData>& entries, int64_t nowMs,
                                             const std::set<std::string>& pendingItemIds);

}  // namespace tentacle::offline
