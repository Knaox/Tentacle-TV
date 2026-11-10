#include "offline/core/reconcile.h"

#include <cmath>

#include "offline/core/args.h"
#include "offline/core/playback.h"
#include "offline/core/rows.h"

namespace tentacle::offline {
namespace {

/// Borne de la charge (le schéma zod d'Electron : `.max(5_000)`).
constexpr size_t kMaxEntries = 5000;

struct LocalState {
  int64_t positionTicks;
  bool played;
  int64_t updatedAt;
};

const Json& list(const Json& value, const char* key) {
  if (!value.is_array()) throw args::Invalid(std::string(key) + " : liste attendue");
  if (value.size() > kMaxEntries) throw args::Invalid(std::string(key) + " : trop longue");
  return value;
}

int64_t truncated(const Json& value) {
  if (value.is_number_integer()) return value.get<int64_t>();
  return static_cast<int64_t>(std::trunc(value.get<double>()));
}

}  // namespace

std::vector<ServerUserData> parseServerUserData(const Json& entries) {
  std::vector<ServerUserData> out;
  for (const Json& entry : list(entries, "entries")) {
    if (!entry.is_object()) throw args::Invalid("entries : objet attendu");
    ServerUserData data;
    data.itemId = args::str(entry, "itemId", 1);
    data.played = args::boolean(entry, "played");
    const Json position = args::number(entry, "positionTicks");
    data.positionTicks = truncated(position);
    if (data.positionTicks < 0) throw args::Invalid("positionTicks : négatif");
    // `.nullable()` : la clé doit être là, `null` = sans date.
    const Json* date = args::field(entry, "lastPlayedAtMs");
    if (date == nullptr) throw args::Invalid("lastPlayedAtMs : requis");
    if (!date->is_null()) data.lastPlayedAtMs = truncated(args::number(entry, "lastPlayedAtMs"));
    out.push_back(std::move(data));
  }
  return out;
}

std::set<std::string> parseItemIds(const Json& ids) {
  std::set<std::string> out;
  for (const Json& id : list(ids, "pendingItemIds")) {
    if (!id.is_string() || id.get<std::string>().empty()) throw args::Invalid("pendingItemIds : chaîne attendue");
    out.insert(id.get<std::string>());
  }
  return out;
}

std::vector<std::string> applyServerUserData(Database& db, const std::string& userId,
                                             const std::vector<ServerUserData>& entries, int64_t nowMs,
                                             const std::set<std::string>& pendingItemIds) {
  std::vector<std::string> changed;
  for (const ServerUserData& entry : entries) {
    const auto row = db.prepare(
                         "SELECT position_ticks, played, updated_at FROM playback_state\n"
                         "     WHERE jellyfin_user_id = ? AND item_id = ?")
                         .get(userId, entry.itemId);
    std::optional<LocalState> local;
    if (row) local = LocalState{integer(*row, "position_ticks"), flag(*row, "played"), integer(*row, "updated_at")};

    std::optional<LocalState> next;
    if (entry.lastPlayedAtMs) {
      if (!local || *entry.lastPlayedAtMs > local->updatedAt) {
        next = LocalState{entry.played ? 0 : entry.positionTicks, entry.played, *entry.lastPlayedAtMs};
      }
    } else if (entry.played && !local) {
      // « Vu » sans date (état importé) : l'appareil n'a aucun avis à lui opposer.
      next = LocalState{0, true, nowMs};
    } else if (!entry.played && entry.positionTicks == 0 && local && local->played &&
               pendingItemIds.count(entry.itemId) == 0) {
      // « Marquer non vu » sur le web : Jellyfin annule la date.
      next = LocalState{0, false, nowMs};
    }
    if (!next) continue;
    if (local && local->positionTicks == next->positionTicks && local->played == next->played) continue;

    // Écriture DIRECTE — pas le `MAX(played)` de `setPlaybackState` : ici le serveur fait foi.
    db.prepare(
          "INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)\n"
          "     VALUES (?, ?, ?, ?, ?)\n"
          "     ON CONFLICT(jellyfin_user_id, item_id) DO UPDATE SET\n"
          "       position_ticks = excluded.position_ticks,\n"
          "       played = excluded.played,\n"
          "       updated_at = excluded.updated_at")
        .run(userId, entry.itemId, next->positionTicks, bit(next->played), next->updatedAt);
    const bool wasPlayed = local ? local->played : false;
    if (!wasPlayed && next->played) {
      scheduleOnPlayed(db, userId, entry.itemId, nowMs);
    } else if (wasPlayed && !next->played) {
      db.prepare(
            "UPDATE claims SET delete_scheduled_at = NULL\n"
            "     WHERE jellyfin_user_id = ? AND file_id IN (SELECT id FROM files WHERE item_id = ?)")
          .run(userId, entry.itemId);
    }
    changed.push_back(entry.itemId);
  }
  return changed;
}

}  // namespace tentacle::offline
