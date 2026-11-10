#include "offline/core/playback.h"

#include <algorithm>

#include "offline/core/files.h"
#include "offline/core/queue.h"
#include "offline/core/rows.h"
#include "offline/core/utf8_path.h"

namespace tentacle::offline {
namespace {

/// Une lecture est active si son battement a moins de 60 s.
constexpr int64_t kActivePlaybackMs = 60000;

Json listSubtitles(const Volume& volume, const std::string& itemId) {
  Json list = Json::array();
  std::filesystem::path dir;
  try {
    dir = safeJoin(volume, "media/" + itemId + "/subs");
  } catch (...) {
    return list;
  }
  // Tri stable par nom (`localeCompare` d'Electron) : nos noms sont en ASCII minuscule,
  // chiffres, `-` et `.`, pour lesquels l'ordre des octets est celui de la collation.
  auto names = files::listFiles(dir);
  std::sort(names.begin(), names.end());
  for (const auto& name : names) {
    list.push_back({{"absolutePath", pathToUtf8(dir / utf8ToPath(name))}, {"fileName", name}});
  }
  return list;
}

/// Le fichier lisible et son chemin, ou rien (fichier passé en défaut).
std::optional<std::pair<FileRow, std::filesystem::path>> readable(Database& db, const Volume& volume,
                                                                  const std::string& userId,
                                                                  const std::string& itemId, int64_t nowMs) {
  const auto file = completeFileForItem(db, userId, itemId);
  if (!file) return std::nullopt;
  std::filesystem::path absolute;
  std::optional<int64_t> size;
  try {
    absolute = safeJoin(volume, file->relPath);
    size = files::size(absolute);
  } catch (...) {
  }
  if (!size) {
    setStatus(db, file->id, "error", "missing", nowMs);
    return std::nullopt;
  }
  if (file->variant == "original" && file->expectedSize && *file->expectedSize > 0 && *size != *file->expectedSize) {
    setStatus(db, file->id, "error", "integrity", nowMs);
    return std::nullopt;
  }
  return std::make_pair(*file, absolute);
}

}  // namespace

std::optional<FileRow> completeFileForItem(Database& db, const std::string& userId, const std::string& itemId) {
  const auto row = db.prepare(std::string("SELECT ") + kFileCols +
                              " FROM files\n"
                              "       JOIN claims ON claims.file_id = files.id\n"
                              "       WHERE claims.jellyfin_user_id = ? AND files.item_id = ?\n"
                              "         AND files.status = 'complete'\n"
                              "       ORDER BY CASE files.variant WHEN 'original' THEN 0 ELSE 1 END\n"
                              "       LIMIT 1")
                       .get(userId, itemId);
  return row ? std::optional<FileRow>(mapFileRow(*row)) : std::nullopt;
}

std::optional<std::string> firstMediaSourceId(Database& db, const std::string& itemId) {
  const auto row = db.prepare("SELECT media_source_id FROM files WHERE item_id = ? ORDER BY id DESC LIMIT 1").get(itemId);
  return row ? std::optional<std::string>(text(*row, "media_source_id")) : std::nullopt;
}

Json localSource(Database& db, const Volume& volume, const std::string& userId, const std::string& itemId,
                 int64_t nowMs) {
  const auto found = readable(db, volume, userId, itemId, nowMs);
  if (!found) return nullptr;
  const FileRow& file = found->first;
  const auto claim = db.prepare(
                           "SELECT auto_delete_after_watch, auto_delete_delay_minutes, delete_scheduled_at\n"
                           "       FROM claims WHERE jellyfin_user_id = ? AND file_id = ?")
                         .get(userId, file.id);
  const auto state = db.prepare("SELECT position_ticks, played FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?")
                         .get(userId, itemId);
  const auto meta = db.prepare(
                          "SELECT title, series_name, runtime_ticks, library_id, index_number, parent_index_number\n"
                          "       FROM item_meta WHERE item_id = ?")
                        .get(itemId);
  const auto metaText = [&](const char* column) { return meta ? opt(textOrNull(*meta, column)) : Json(nullptr); };
  const auto metaNumber = [&](const char* column) { return meta ? numberOrNull(*meta, column) : Json(nullptr); };
  return {
      {"fileId", file.id},
      {"variant", file.variant},
      {"absolutePath", pathToUtf8(found->second)},
      {"subtitleFiles", listSubtitles(volume, itemId)},
      {"positionTicks", state ? number(*state, "position_ticks") : Json(0)},
      {"played", state && flag(*state, "played")},
      {"autoDeleteAfterWatch", claim && flag(*claim, "auto_delete_after_watch")},
      {"autoDeleteDelayMinutes", claim ? number(*claim, "auto_delete_delay_minutes") : Json(0)},
      {"deleteScheduledAt", claim ? numberOrNull(*claim, "delete_scheduled_at") : Json(nullptr)},
      {"title", metaText("title")},
      {"seriesName", metaText("series_name")},
      {"runtimeTicks", metaNumber("runtime_ticks")},
      {"indexNumber", metaNumber("index_number")},
      {"parentIndexNumber", metaNumber("parent_index_number")},
      {"libraryId", metaText("library_id")},
      {"audioStreamIndex", opt(file.audioStreamIndex)},
  };
}

std::optional<std::string> localSourcePath(Database& db, const Volume& volume, const std::string& userId,
                                           const std::string& itemId, int64_t nowMs) {
  const auto found = readable(db, volume, userId, itemId, nowMs);
  return found ? std::optional<std::string>(pathToUtf8(found->second)) : std::nullopt;
}

void setPlaybackState(Database& db, const std::string& userId, const std::string& itemId, const Json& positionTicks,
                      bool played, bool queueForSync, int64_t nowMs) {
  const Param position = numberParam(positionTicks);
  db.prepare(
        "INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)\n"
        "     VALUES (?, ?, ?, ?, ?)\n"
        "     ON CONFLICT(jellyfin_user_id, item_id) DO UPDATE SET\n"
        "       position_ticks = excluded.position_ticks,\n"
        "       played = MAX(playback_state.played, excluded.played),\n"
        "       updated_at = excluded.updated_at")
      .run(userId, itemId, position, bit(played), nowMs);
  if (queueForSync) {
    db.prepare(
          "INSERT INTO report_queue (jellyfin_user_id, item_id, position_ticks, played, occurred_at_utc)\n"
          "       VALUES (?, ?, ?, ?, ?)")
        .run(userId, itemId, position, bit(played), nowMs);
  }
}

void restartPlayback(Database& db, const std::string& userId, const std::string& itemId, int64_t nowMs) {
  db.prepare(
        "UPDATE playback_state SET position_ticks = 0, played = 0, updated_at = ?\n"
        "     WHERE jellyfin_user_id = ? AND item_id = ?")
      .run(nowMs, userId, itemId);
  db.prepare(
        "UPDATE claims SET delete_scheduled_at = NULL\n"
        "     WHERE jellyfin_user_id = ?\n"
        "       AND file_id IN (SELECT id FROM files WHERE item_id = ?)")
      .run(userId, itemId);
}

Json pendingReports(Database& db, const std::string& userId) {
  Json list = Json::array();
  for (const Row& row : db.prepare(
                              "SELECT id, item_id, position_ticks, played, occurred_at_utc\n"
                              "       FROM report_queue AS rq\n"
                              "       WHERE synced = 0 AND jellyfin_user_id = ?\n"
                              "         AND id = (SELECT MAX(id) FROM report_queue\n"
                              "                   WHERE jellyfin_user_id = rq.jellyfin_user_id\n"
                              "                     AND item_id = rq.item_id AND synced = 0)\n"
                              "       ORDER BY id ASC")
                            .all(userId)) {
    list.push_back({{"id", integer(row, "id")},
                    {"itemId", text(row, "item_id")},
                    {"positionTicks", number(row, "position_ticks")},
                    {"played", flag(row, "played")},
                    {"occurredAtUtc", number(row, "occurred_at_utc")}});
  }
  return list;
}

void markItemSynced(Database& db, const std::string& userId, const std::string& itemId, int64_t upToId) {
  db.prepare("UPDATE report_queue SET synced = 1\n     WHERE jellyfin_user_id = ? AND item_id = ? AND id <= ?")
      .run(userId, itemId, upToId);
}

void scheduleOnPlayed(Database& db, const std::string& userId, const std::string& itemId, int64_t nowMs) {
  db.prepare(
        "UPDATE claims SET delete_scheduled_at = ? + auto_delete_delay_minutes * 60\n"
        "     WHERE jellyfin_user_id = ?\n"
        "       AND auto_delete_after_watch = 1\n"
        "       AND delete_scheduled_at IS NULL\n"
        "       AND file_id IN (SELECT id FROM files WHERE item_id = ?)\n"
        "       AND EXISTS (SELECT 1 FROM playback_state\n"
        "                   WHERE jellyfin_user_id = ? AND item_id = ? AND played = 1)")
      .run(nowMs / 1000, userId, itemId, userId, itemId);
}

int64_t purgeDueClaims(Database& db, const Volume& volume, int64_t nowMs, const std::optional<std::string>& exemptItem,
                       const std::optional<std::string>& protectedItem) {
  struct Due {
    std::string userId;
    int64_t fileId;
    std::string itemId;
  };
  std::vector<Due> due;
  for (const Row& row : db.prepare(
                              "SELECT c.jellyfin_user_id, c.file_id, f.item_id\n"
                              "       FROM claims c JOIN files f ON f.id = c.file_id\n"
                              "       WHERE c.auto_delete_after_watch = 1\n"
                              "         AND c.delete_scheduled_at IS NOT NULL\n"
                              "         AND c.delete_scheduled_at <= ?")
                            .all(nowMs / 1000)) {
    due.push_back({text(row, "jellyfin_user_id"), integer(row, "file_id"), text(row, "item_id")});
  }
  int64_t purges = 0;
  for (const auto& d : due) {
    if (protectedItem && d.itemId == *protectedItem) continue;
    if (!(exemptItem && d.itemId == *exemptItem)) {
      // Re-visionnage en cours : sauté, retenté au prochain tour.
      const auto state = db.prepare("SELECT updated_at FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?")
                             .get(d.userId, d.itemId);
      if (state && nowMs - integer(*state, "updated_at") < kActivePlaybackMs) continue;
    }
    try {
      deleteClaim(db, volume, d.userId, d.fileId);
      ++purges;  // le CLAIM retiré compte, même quand le disque reste (deux comptes)
    } catch (...) {
      // Disque débranché ou droits : retenté au tour suivant.
    }
  }
  return purges;
}

int64_t diskUsage(Database& db) {
  const auto row = db.prepare("SELECT COALESCE(SUM(bytes_done), 0) AS n FROM files").get();
  return row ? integer(*row, "n") : 0;
}

}  // namespace tentacle::offline
