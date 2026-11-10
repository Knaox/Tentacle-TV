#include "offline/core/meta.h"

#include <cmath>

#include "offline/core/files.h"
#include "offline/core/rows.h"

namespace tentacle::offline {

void upsertItemMeta(Database& db, const MetaSpec& s, int64_t nowMs) {
  db.prepare(
        "INSERT INTO item_meta (item_id, kind, series_id, season_id, library_id,\n"
        "                            runtime_ticks, title, series_name,\n"
        "                            index_number, parent_index_number, created_at, updated_at)\n"
        "     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n"
        "     ON CONFLICT(item_id) DO UPDATE SET\n"
        "       kind = excluded.kind,\n"
        "       series_id = excluded.series_id,\n"
        "       season_id = excluded.season_id,\n"
        "       library_id = excluded.library_id,\n"
        "       runtime_ticks = excluded.runtime_ticks,\n"
        "       title = COALESCE(excluded.title, item_meta.title),\n"
        "       series_name = COALESCE(excluded.series_name, item_meta.series_name),\n"
        "       index_number = COALESCE(excluded.index_number, item_meta.index_number),\n"
        "       parent_index_number = COALESCE(excluded.parent_index_number, item_meta.parent_index_number),\n"
        "       updated_at = excluded.updated_at")
      .run(s.itemId, s.kind, s.seriesId, s.seasonId, s.libraryId, s.runtimeTicks, s.title, s.seriesName, s.indexNumber,
           s.parentIndexNumber, nowMs, nowMs);
}

std::optional<MetaSpec> getSpec(Database& db, const std::string& itemId) {
  const auto row = db.prepare(
                         "SELECT item_id, kind, series_id, season_id, library_id, runtime_ticks, title,\n"
                         "              series_name, index_number, parent_index_number\n"
                         "       FROM item_meta WHERE item_id = ?")
                       .get(itemId);
  if (!row) return std::nullopt;
  MetaSpec s;
  s.itemId = text(*row, "item_id");
  s.kind = text(*row, "kind");
  s.seriesId = textOrNull(*row, "series_id");
  s.seasonId = textOrNull(*row, "season_id");
  s.libraryId = textOrNull(*row, "library_id");
  s.runtimeTicks = integerOrNull(*row, "runtime_ticks");
  s.title = textOrNull(*row, "title");
  s.seriesName = textOrNull(*row, "series_name");
  s.indexNumber = integerOrNull(*row, "index_number");
  s.parentIndexNumber = integerOrNull(*row, "parent_index_number");
  return s;
}

bool saveBytes(const Volume& volume, const std::string& rel, const std::vector<uint8_t>& bytes) {
  try {
    const auto target = safeJoin(volume, rel);
    files::mkdirp(target.parent_path());
    files::writeBytes(target, bytes);
    return true;
  } catch (...) {
    return false;
  }
}

bool snapshotExists(const Volume& volume, const std::string& itemId) {
  return mediaFileExists(volume, "meta/" + itemId + "/item.json");
}

bool seriesPrimaryExists(const Volume& volume, const std::string& itemId) {
  return mediaFileExists(volume, "meta/" + itemId + "/series-primary.jpg");
}

int64_t metaVersion(Database& db, const std::string& itemId) {
  const auto row = db.prepare("SELECT COALESCE(meta_version, 0) AS v FROM item_meta WHERE item_id = ?").get(itemId);
  return row ? integer(*row, "v") : 0;
}

void markSnapshotDone(Database& db, const std::string& itemId, const std::string& imagesState, int64_t nowMs) {
  db.prepare("UPDATE item_meta SET images_state = ?, meta_version = ?, updated_at = ? WHERE item_id = ?")
      .run(imagesState, kCurrentMetaVersion, nowMs, itemId);
}

void setLibrary(Database& db, const std::string& itemId, const LibraryRef& library) {
  db.prepare("UPDATE item_meta SET library_id = ?, library_name = ?, library_type = ? WHERE item_id = ?")
      .run(library.id, library.name, library.collectionType, itemId);
}

Json parseJson(const std::vector<uint8_t>& bytes) {
  return parseJsonText(std::string(bytes.begin(), bytes.end()));
}

Json parseJsonText(const std::string& text) {
  Json value = Json::parse(text, nullptr, false, false);
  if (!value.is_discarded()) return value;
  // Une séquence UTF-8 invalide ne fait pas échouer `TextDecoder` (elle devient U+FFFD) ;
  // nlohmann, si. On remplace comme lui, puis on réessaie.
  std::string clean;
  clean.reserve(text.size());
  for (size_t i = 0; i < text.size();) {
    const auto c = static_cast<unsigned char>(text[i]);
    size_t need = c < 0x80 ? 0 : (c >= 0xc2 && c <= 0xdf) ? 1 : (c >= 0xe0 && c <= 0xef) ? 2 : (c >= 0xf0 && c <= 0xf4) ? 3 : 4;
    bool ok = need < 4 && i + need < text.size() + (need == 0 ? 1 : 0);
    for (size_t k = 1; ok && k <= need; ++k) ok = i + k < text.size() && (static_cast<unsigned char>(text[i + k]) & 0xc0) == 0x80;
    if (ok) {
      clean.append(text, i, need + 1);
      i += need + 1;
    } else {
      clean += "\xEF\xBF\xBD";
      i += 1;
    }
  }
  value = Json::parse(clean, nullptr, false, false);
  return value.is_discarded() ? Json(nullptr) : value;
}

const Json* jsonField(const Json& value, const char* key) {
  if (!value.is_object()) return nullptr;
  const auto it = value.find(key);
  return it == value.end() ? nullptr : &*it;
}

std::optional<int64_t> asInteger(const Json* value) {
  if (value == nullptr) return std::nullopt;
  if (value->is_number_integer()) return value->get<int64_t>();
  if (value->is_number_float()) {
    const double d = value->get<double>();
    if (!std::isfinite(d)) return std::nullopt;
    return static_cast<int64_t>(std::trunc(d));
  }
  return std::nullopt;
}

std::optional<std::string> asString(const Json* value) {
  if (value == nullptr || !value->is_string()) return std::nullopt;
  std::string s = value->get<std::string>();
  return s.empty() ? std::nullopt : std::optional<std::string>(s);
}

}  // namespace tentacle::offline
