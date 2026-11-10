// La musique gardée, lue pour Octave — `core/musicLibrary.ts` (hors pochette) et
// `ipc/audioKept.ts`. Tout est PAR COMPTE (les claims).

#include "offline/core/meta.h"
#include "offline/core/music.h"
#include "offline/core/playback.h"
#include "offline/core/rows.h"
#include "offline/core/store.h"

namespace tentacle::offline::music {
namespace {

Json mapKept(const Row& row) {
  const FileRow file = mapFileRow(row);
  return {
      {"fileId", file.id},
      {"itemId", file.itemId},
      {"trackKey", text(row, "track_key")},
      {"origin", text(row, "origin") == "external" ? "external" : "library"},
      {"variant", file.variant},
      {"preset", opt(file.preset)},
      {"status", file.status},
      {"errorCode", opt(file.errorCode)},
      {"pausedByUser", flag(row, "paused_by_user")},
      {"bytesDone", file.bytesDone},
      {"expectedSize", opt(file.expectedSize)},
      {"preparing", file.phase == std::optional<std::string>("prepare")},
      {"retryAt", opt(file.nextRetryAt)},
      {"title", text(row, "title")},
      {"artist", opt(textOrNull(row, "artist"))},
      {"album", opt(textOrNull(row, "album"))},
      {"albumKey", opt(textOrNull(row, "album_key"))},
      {"discNumber", numberOrNull(row, "disc_number")},
      {"trackNumber", numberOrNull(row, "track_number")},
      {"durationMs", numberOrNull(row, "duration_ms")},
      {"coverRel", opt(textOrNull(row, "cover_rel"))},
      {"sourcePath", opt(file.sourcePath)},
      {"trackJson", text(row, "track_json")},
      {"createdAt", number(row, "created_at")},
  };
}

std::string kindOf(const std::string& raw) { return raw == "playlist" || raw == "track" ? raw : "album"; }

Json parseKeys(const std::string& raw) {
  Json keys = Json::array();
  const Json value = parseJsonText(raw);
  if (!value.is_array()) return keys;
  for (const Json& key : value) {
    if (key.is_string()) keys.push_back(key);
  }
  return keys;
}

}  // namespace

Json listMusicForUser(Database& db, const std::string& userId) {
  Json list = Json::array();
  const std::string sql =
      std::string("SELECT ") + kFileCols +
      ", files.paused_by_user, files.created_at, m.track_key, m.origin, m.title, m.artist,\n"
      "              m.album, m.album_key, m.disc_number, m.track_number, m.duration_ms, m.cover_rel, m.track_json\n"
      "       FROM files\n"
      "       JOIN claims ON claims.file_id = files.id\n"
      "       JOIN music_meta m ON m.item_id = files.item_id\n"
      "       WHERE claims.jellyfin_user_id = ?\n"
      "       ORDER BY COALESCE(m.album, ''), COALESCE(m.disc_number, 0), COALESCE(m.track_number, 0), m.title, files.id";
  for (const Row& row : db.prepare(sql).all(userId)) list.push_back(mapKept(row));
  return list;
}

std::optional<std::string> musicItemOfKey(Database& db, const std::string& trackKey) {
  const auto row = db.prepare("SELECT item_id FROM music_meta WHERE track_key = ?").get(trackKey);
  return row ? std::optional<std::string>(text(*row, "item_id")) : std::nullopt;
}

bool isMusicItem(Database& db, const std::string& itemId) {
  return db.prepare("SELECT 1 AS one FROM music_meta WHERE item_id = ?").get(itemId).has_value();
}

void saveMusicCollection(Database& db, const std::string& userId, const Collection& c, int64_t nowMs) {
  db.prepare(
        "INSERT INTO music_collections (jellyfin_user_id, collection_key, kind, title, subtitle, cover_item_id,\n"
        "                                    track_keys_json, created_at, updated_at)\n"
        "     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n"
        "     ON CONFLICT(jellyfin_user_id, collection_key) DO UPDATE SET kind = excluded.kind, title = excluded.title,\n"
        "       subtitle = excluded.subtitle, cover_item_id = excluded.cover_item_id,\n"
        "       track_keys_json = excluded.track_keys_json, updated_at = excluded.updated_at")
      .run(userId, c.key, c.kind, c.title, c.subtitle, c.coverItemId, Json(c.trackKeys).dump(), nowMs, nowMs);
}

void deleteMusicCollection(Database& db, const std::string& userId, const std::string& key) {
  db.prepare("DELETE FROM music_collections WHERE jellyfin_user_id = ? AND collection_key = ?").run(userId, key);
}

Json listMusicCollections(Database& db, const std::string& userId) {
  Json list = Json::array();
  for (const Row& row : db.prepare(
                              "SELECT collection_key, kind, title, subtitle, cover_item_id, track_keys_json, updated_at\n"
                              "       FROM music_collections WHERE jellyfin_user_id = ? ORDER BY updated_at DESC")
                            .all(userId)) {
    list.push_back({{"key", text(row, "collection_key")},
                    {"kind", kindOf(text(row, "kind"))},
                    {"title", text(row, "title")},
                    {"subtitle", opt(textOrNull(row, "subtitle"))},
                    {"coverItemId", opt(textOrNull(row, "cover_item_id"))},
                    {"trackKeys", parseKeys(text(row, "track_keys_json"))},
                    {"updatedAt", number(row, "updated_at")}});
  }
  return list;
}

std::optional<std::string> keptAudioPath(Database& db, const Volume& volume, const std::string& userId,
                                         const std::string& trackKey, int64_t nowMs) {
  try {
    const auto itemId = musicItemOfKey(db, trackKey);
    if (!itemId) return std::nullopt;
    return localSourcePath(db, volume, userId, *itemId, nowMs);
  } catch (...) {
    // Base ou racine indisponible : le serveur, comme si rien n'était gardé.
    return std::nullopt;
  }
}

}  // namespace tentacle::offline::music
