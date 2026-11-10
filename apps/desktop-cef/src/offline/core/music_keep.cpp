// Garder hors ligne la musique : validation et mise en file — `core/musicKeep.ts`.

#include <cstdio>
#include <regex>
#include <stdexcept>

#include "offline/core/args.h"
#include "offline/core/music.h"
#include "offline/core/queue.h"
#include "offline/core/store.h"

namespace tentacle::offline::music {
namespace {

constexpr size_t kMaxTrackJson = 32 * 1024;

/// Les unités UTF-16 d'un texte UTF-8 (ce que lit `charCodeAt`).
std::vector<uint16_t> utf16Units(const std::string& utf8) {
  std::vector<uint16_t> units;
  for (size_t i = 0; i < utf8.size();) {
    const auto c = static_cast<unsigned char>(utf8[i]);
    uint32_t cp = c;
    size_t width = 1;
    if (c >= 0xf0) cp = c & 0x07, width = 4;
    else if (c >= 0xe0) cp = c & 0x0f, width = 3;
    else if (c >= 0xc0) cp = c & 0x1f, width = 2;
    for (size_t k = 1; k < width && i + k < utf8.size(); ++k) cp = (cp << 6) | (static_cast<unsigned char>(utf8[i + k]) & 0x3f);
    if (cp >= 0x10000) {
      cp -= 0x10000;
      units.push_back(static_cast<uint16_t>(0xd800 + (cp >> 10)));
      units.push_back(static_cast<uint16_t>(0xdc00 + (cp & 0x3ff)));
    } else {
      units.push_back(static_cast<uint16_t>(cp));
    }
    i += width;
  }
  return units;
}

bool validExt(const std::string& value) {
  static const std::regex pattern("^[a-z0-9]{1,5}$");
  return std::regex_match(value, pattern);
}

bool artworkAllowed(const KeepItem& item) {
  if (!item.artworkPath) return true;
  return isServerPath(*item.artworkPath) || (item.origin == "external" && isPublicArtUrl(*item.artworkPath));
}

std::optional<int64_t> count(const Json& j, const char* key) { return args::optInteger(j, key, true, 0); }

}  // namespace

KeepItem keepItemFromJson(const Json& j) {
  KeepItem it;
  it.trackKey = args::str(j, "trackKey", 1, 400);
  it.origin = args::oneOf(j, "origin", {"library", "external"});
  it.sourcePath = args::str(j, "sourcePath", 1, 600);
  it.variant = args::oneOf(j, "variant", {"original", "light"});
  it.preset = args::nullableStr(j, "preset", 0, 5);
  it.containerExt = args::str(j, "containerExt", 1, 5);
  it.expectedSize = count(j, "expectedSize");
  it.estimatedSize = count(j, "estimatedSize");
  it.title = args::str(j, "title", 1, 1000);
  it.artist = args::nullableStr(j, "artist", 0, 1000);
  it.album = args::nullableStr(j, "album", 0, 1000);
  it.albumKey = args::nullableStr(j, "albumKey", 0, 400);
  it.discNumber = args::optInteger(j, "discNumber", true);
  it.trackNumber = args::optInteger(j, "trackNumber", true);
  it.durationMs = count(j, "durationMs");
  it.artworkPath = args::nullableStr(j, "artworkPath", 0, 600);
  it.trackJson = args::str(j, "trackJson", 0, 32 * 1024);
  return it;
}

Collection collectionFromJson(const Json& j) {
  Collection c;
  c.key = args::str(j, "key", 1, 500);
  c.kind = args::oneOf(j, "kind", {"album", "playlist", "track"});
  c.title = args::str(j, "title", 1, 1000);
  c.subtitle = args::nullableStr(j, "subtitle", 0, 1000);
  c.coverItemId = args::nullableStr(j, "coverItemId", 0, 64);
  const Json* keys = args::field(j, "trackKeys");
  if (keys == nullptr || !keys->is_array() || keys->size() > 5000) throw args::Invalid("trackKeys : tableau attendu");
  for (const Json& key : *keys) {
    if (!key.is_string() || args::utf16Length(key.get<std::string>()) > 400) throw args::Invalid("trackKeys : clé refusée");
    c.trackKeys.push_back(key.get<std::string>());
  }
  return c;
}

std::string digest(const std::string& utf8) {
  const auto units = utf16Units(utf8);
  std::string out;
  for (const uint32_t seed : {0x811c9dc5u, 0x01000193u, 0x9e3779b9u, 0x85ebca6bu}) {
    uint32_t hash = seed;
    for (const uint16_t unit : units) {
      hash ^= unit;
      hash *= 0x01000193u;  // `Math.imul(hash, 0x01000193) >>> 0` : produit modulo 2^32
    }
    char hex[9];
    std::snprintf(hex, sizeof hex, "%08x", hash);
    out += hex;
  }
  return out;
}

std::optional<std::string> musicItemId(const std::string& trackKey) {
  static const std::regex jellyfinId(
      "^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
  if (trackKey.rfind("jf:", 0) == 0) {
    const std::string id = trackKey.substr(3);
    if (!std::regex_match(id, jellyfinId)) return std::nullopt;
    std::string clean;
    for (const char c : id) {
      if (c != '-') clean.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    }
    return clean;
  }
  const size_t length = args::utf16Length(trackKey);
  if (trackKey.rfind("ext:", 0) == 0 && length > 6 && length <= 400) return "ext-" + digest(trackKey);
  return std::nullopt;
}

bool isPublicArtUrl(const std::string& url) {
  // `new URL()` : https, aucun identifiant, et aucun jeton dans la requête.
  if (args::utf16Length(url) > 600 || url.rfind("https://", 0) != 0) return false;
  if (!args::isHttpUrl(url)) return false;
  const size_t query = url.find('?');
  if (query == std::string::npos) return true;
  const size_t hash = url.find('#', query);
  const std::string search = url.substr(query, hash == std::string::npos ? std::string::npos : hash - query);
  static const std::regex token("[?&](api_key|apikey|token)=", std::regex::icase);
  return !std::regex_search(search, token);
}

bool isServerPath(const std::string& path) {
  static const std::regex pattern(R"(^/api/[A-Za-z0-9_\-./%]+(\?[A-Za-z0-9_\-.=&%+*]*)?$)");
  return args::utf16Length(path) <= 600 && std::regex_match(path, pattern) && path.find("..") == std::string::npos &&
         path.find("//") == std::string::npos;
}

void validateMusicBatch(const std::vector<KeepItem>& items) {
  if (items.empty()) throw std::runtime_error("empty-batch");
  for (const auto& item : items) {
    const bool ok = musicItemId(item.trackKey).has_value() &&
                    (item.origin == "library") == (item.trackKey.rfind("jf:", 0) == 0) && isServerPath(item.sourcePath) &&
                    artworkAllowed(item) && (item.variant == "original" || item.variant == "light") &&
                    (!item.preset || validExt(*item.preset)) && validExt(item.containerExt) && !item.title.empty() &&
                    args::utf16Length(item.trackJson) <= kMaxTrackJson;
    if (!ok) throw std::runtime_error("invalid-item");
  }
}

std::string musicRelPath(const std::string& itemId, const KeepItem& item) {
  if (item.variant == "light") return "media/" + itemId + "/audio-" + item.preset.value_or("a256") + ".m4a";
  return "media/" + itemId + "/audio-original." + item.containerExt;
}

namespace {

FileIdentity identityOf(const std::string& itemId, const KeepItem& item) {
  // Un titre n'a qu'une source : son identifiant d'item en tient lieu.
  return {itemId, itemId, item.variant, item.variant == "light" ? item.preset : std::nullopt};
}

void upsertMusicMeta(Database& db, const std::string& itemId, const KeepItem& item, int64_t nowMs) {
  db.prepare(
        "INSERT INTO music_meta (item_id, track_key, origin, title, artist, album, album_key, disc_number,\n"
        "                             track_number, duration_ms, artwork_path, track_json, created_at, updated_at)\n"
        "     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n"
        "     ON CONFLICT(item_id) DO UPDATE SET title = excluded.title, artist = excluded.artist, album = excluded.album,\n"
        "       album_key = excluded.album_key, disc_number = excluded.disc_number, track_number = excluded.track_number,\n"
        "       duration_ms = excluded.duration_ms, artwork_path = excluded.artwork_path, track_json = excluded.track_json,\n"
        "       updated_at = excluded.updated_at")
      .run(itemId, item.trackKey, item.origin, item.title, item.artist, item.album, item.albumKey, item.discNumber,
           item.trackNumber, item.durationMs, item.artworkPath, item.trackJson, nowMs, nowMs);
}

}  // namespace

Json enqueueMusicBatch(Database& db, const std::string& userId, std::vector<KeepItem> batch, int64_t freeBytes,
                       int64_t nowMs, int64_t margin) {
  // Une pochette qu'on ne peut pas garder n'empêche jamais de garder le titre.
  for (auto& item : batch) {
    if (item.artworkPath && !artworkAllowed(item)) item.artworkPath.reset();
  }
  validateMusicBatch(batch);
  int64_t needed = pendingBytes(db);
  for (const auto& item : batch) {
    const auto existing = findFile(db, identityOf(*musicItemId(item.trackKey), item));
    if (!existing || existing->status == "canceled") needed += item.estimatedSize.value_or(item.expectedSize.value_or(0));
  }
  if (needed > 0 && !hasCapacity(needed, freeBytes, margin)) {
    return {{"accepted", false}, {"neededBytes", needed}, {"freeBytes", freeBytes}, {"fileIds", Json::array()}};
  }
  Json fileIds = Json::array();
  for (const auto& item : batch) {
    const std::string itemId = *musicItemId(item.trackKey);
    upsertMusicMeta(db, itemId, item, nowMs);
    const auto expected = item.expectedSize ? item.expectedSize : (item.variant == "light" ? item.estimatedSize : std::nullopt);
    const ClaimOutcome outcome =
        claimOrCreateFile(db, {identityOf(itemId, item), userId, musicRelPath(itemId, item), expected, false, nowMs});
    // Posé à chaque fois : une adresse d'extension a pu changer depuis le premier essai.
    db.prepare("UPDATE files SET source_path = ? WHERE id = ?").run(item.sourcePath, outcome.fileId);
    fileIds.push_back(outcome.fileId);
  }
  return {{"accepted", true}, {"neededBytes", needed}, {"freeBytes", freeBytes}, {"fileIds", fileIds}};
}

}  // namespace tentacle::offline::music
