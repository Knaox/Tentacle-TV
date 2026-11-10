#include "offline/core/listing.h"

#include <algorithm>
#include <stdexcept>

#include "offline/core/rows.h"
#include "offline/core/store.h"
#include "offline/core/subs.h"

namespace tentacle::offline {
namespace {

const char* const kExtraCols =
    "item_meta.title, item_meta.series_name, item_meta.kind, item_meta.series_id,\n"
    "   item_meta.season_id, item_meta.library_id, item_meta.library_name, item_meta.library_type,\n"
    "   item_meta.index_number, item_meta.parent_index_number,\n"
    "   item_meta.runtime_ticks, claims.auto_delete_after_watch,\n"
    "   claims.auto_delete_delay_minutes, claims.delete_scheduled_at,\n"
    "   playback_state.played, playback_state.position_ticks,\n"
    "   files.created_at, playback_state.updated_at AS last_played_at, files.paused_by_user";

/// Progression du PROPRIÉTAIRE DU CLAIM : deux comptes partagent le fichier, pas l'endroit.
const char* const kPlaybackJoin =
    "LEFT JOIN playback_state\n"
    "     ON playback_state.item_id = files.item_id\n"
    "    AND playback_state.jellyfin_user_id = claims.jellyfin_user_id";

Json kindOf(const Row& row) {
  const auto value = textOrNull(row, "kind");
  if (!value) return nullptr;
  if (*value != "movie" && *value != "episode") throw std::runtime_error("colonne kind : valeur inattendue " + *value);
  return *value;
}

Json mapEntry(const Row& row) {
  const FileRow file = mapFileRow(row);
  Json entry = publicFile(file);
  entry["subtitlesExpected"] = file.subtitlesJson ? parseSpecs(*file.subtitlesJson).size() : 0;
  entry["title"] = opt(textOrNull(row, "title"));
  entry["seriesName"] = opt(textOrNull(row, "series_name"));
  entry["kind"] = kindOf(row);
  entry["seriesId"] = opt(textOrNull(row, "series_id"));
  entry["seasonId"] = opt(textOrNull(row, "season_id"));
  entry["libraryId"] = opt(textOrNull(row, "library_id"));
  entry["libraryName"] = opt(textOrNull(row, "library_name"));
  entry["libraryType"] = opt(textOrNull(row, "library_type"));
  entry["indexNumber"] = numberOrNull(row, "index_number");
  entry["parentIndexNumber"] = numberOrNull(row, "parent_index_number");
  entry["runtimeTicks"] = numberOrNull(row, "runtime_ticks");
  entry["autoDeleteAfterWatch"] = flag(row, "auto_delete_after_watch");
  entry["autoDeleteDelayMinutes"] = number(row, "auto_delete_delay_minutes");
  entry["deleteScheduledAt"] = numberOrNull(row, "delete_scheduled_at");
  // Jointure EXTERNE : un item jamais ouvert n'a pas de ligne de progression.
  entry["played"] = integerOrNull(row, "played").value_or(0) != 0;
  const Json position = numberOrNull(row, "position_ticks");
  entry["positionTicks"] = position.is_null() ? Json(0) : position;
  entry["createdAt"] = number(row, "created_at");
  entry["lastPlayedAt"] = numberOrNull(row, "last_played_at");
  entry["pausedByUser"] = flag(row, "paused_by_user");
  return entry;
}

}  // namespace

Json listForUser(Database& db, const std::string& userId) {
  Json list = Json::array();
  const std::string sql = std::string("SELECT ") + kFileCols + ", " + kExtraCols +
                          " FROM files\n"
                          "       JOIN claims ON claims.file_id = files.id\n"
                          "       LEFT JOIN item_meta ON item_meta.item_id = files.item_id\n"
                          "       " + kPlaybackJoin +
                          "\n       WHERE claims.jellyfin_user_id = ?\n"
                          "         AND NOT EXISTS (SELECT 1 FROM music_meta WHERE music_meta.item_id = files.item_id)\n"
                          "       ORDER BY files.created_at DESC, files.id DESC";
  for (const Row& row : db.prepare(sql).all(userId)) list.push_back(mapEntry(row));
  return list;
}

Json stateForItem(Database& db, const std::string& userId, const std::string& itemId) {
  const std::string sql = std::string("SELECT ") + kFileCols + ", " + kExtraCols +
                          " FROM files\n"
                          "       JOIN claims ON claims.file_id = files.id\n"
                          "       LEFT JOIN item_meta ON item_meta.item_id = files.item_id\n"
                          "       " + kPlaybackJoin +
                          "\n       WHERE claims.jellyfin_user_id = ? AND files.item_id = ?\n"
                          "       ORDER BY CASE files.status WHEN 'complete' THEN 0 ELSE 1 END,\n"
                          "                CASE files.variant WHEN 'original' THEN 0 ELSE 1 END,\n"
                          "                files.created_at DESC\n"
                          "       LIMIT 1";
  const auto row = db.prepare(sql).get(userId, itemId);
  return row ? mapEntry(*row) : Json(nullptr);
}

void setAutoDelete(Database& db, const std::string& userId, int64_t fileId, bool enabled, int64_t delayMinutes,
                   int64_t nowMs) {
  if (!enabled) {
    db.prepare(
          "UPDATE claims SET auto_delete_after_watch = 0, auto_delete_delay_minutes = 0,\n"
          "              delete_scheduled_at = NULL\n"
          "       WHERE jellyfin_user_id = ? AND file_id = ?")
        .run(userId, fileId);
    return;
  }
  const int64_t delay = std::max<int64_t>(0, delayMinutes);
  const auto current = db.prepare(
                             "SELECT c.delete_scheduled_at, c.auto_delete_delay_minutes, f.item_id\n"
                             "       FROM claims c JOIN files f ON f.id = c.file_id\n"
                             "       WHERE c.jellyfin_user_id = ? AND c.file_id = ?")
                           .get(userId, fileId);
  if (!current) return;
  const auto scheduled = integerOrNull(*current, "delete_scheduled_at");
  const int64_t oldDelay = integer(*current, "auto_delete_delay_minutes");
  const std::string itemId = text(*current, "item_id");

  std::optional<int64_t> next;
  if (scheduled) {
    next = *scheduled - oldDelay * 60 + delay * 60;
  } else {
    const auto state = db.prepare("SELECT played FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?")
                           .get(userId, itemId);
    const bool played = state && flag(*state, "played");
    if (played) next = nowMs / 1000 + delay * 60;
  }
  db.prepare(
        "UPDATE claims SET auto_delete_after_watch = 1, auto_delete_delay_minutes = ?,\n"
        "            delete_scheduled_at = ?\n"
        "     WHERE jellyfin_user_id = ? AND file_id = ?")
      .run(delay, next, userId, fileId);
}

}  // namespace tentacle::offline
