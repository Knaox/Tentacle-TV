// La réparation au démarrage (`heal.ts`) et la pochette d'un titre gardé (`musicLibrary.ts`).

#include "offline/core/music.h"
#include "offline/core/playback.h"
#include "offline/core/rows.h"
#include "offline/core/sidecars.h"
#include "offline/core/store.h"

namespace tentacle::offline {
namespace {

/// L'extension d'une image d'après ses premiers octets ; rien : pas une image connue.
std::optional<std::string> imageExt(const Bytes& b) {
  if (b.size() >= 2 && b[0] == 0xff && b[1] == 0xd8) return "jpg";
  if (b.size() >= 4 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4e && b[3] == 0x47) return "png";
  if (b.size() >= 12 && std::string(b.begin(), b.begin() + 4) == "RIFF" && std::string(b.begin() + 8, b.begin() + 12) == "WEBP") {
    return "webp";
  }
  return std::nullopt;
}

struct CompleteItem {
  std::string itemId, mediaSourceId;
  std::optional<std::string> subtitlesJson;
};

}  // namespace

Task<bool> fetchMusicCover(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, std::string itemId,
                           FetchBytes fetchPublic) {
  const auto row = db.prepare("SELECT artwork_path, cover_rel FROM music_meta WHERE item_id = ?").get(itemId);
  if (!row) co_return false;
  const auto current = textOrNull(*row, "cover_rel");
  if (current && mediaFileExists(volume, *current)) co_return false;
  const auto artwork = textOrNull(*row, "artwork_path");
  if (!artwork) co_return false;
  const bool elsewhere = music::isPublicArtUrl(*artwork);
  if (elsewhere && !fetchPublic) co_return false;
  std::optional<Bytes> bytes;
  if (elsewhere) bytes = co_await fetch(fetchPublic, *artwork, kMaxTileBytes);
  else if (music::isServerPath(*artwork)) bytes = co_await fetch(fetchBytes, serverUrl + *artwork, kMaxTileBytes);
  const auto ext = bytes ? imageExt(*bytes) : std::nullopt;
  if (!bytes || !ext) co_return false;
  const std::string rel = "media/" + itemId + "/cover." + *ext;
  if (!saveBytes(volume, rel, *bytes)) co_return false;
  db.prepare("UPDATE music_meta SET cover_rel = ? WHERE item_id = ?").run(rel, itemId);
  co_return true;
}

Task<int64_t> heal(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, int64_t nowMs,
                   FetchBytes fetchPublic) {
  int64_t healed = 0;
  std::vector<CompleteItem> complete;
  for (const Row& row : db.prepare(
                              "SELECT DISTINCT item_id, media_source_id, subtitles_json\n"
                              "       FROM files WHERE status = 'complete'\n"
                              "         AND NOT EXISTS (SELECT 1 FROM music_meta WHERE music_meta.item_id = files.item_id)")
                            .all()) {
    complete.push_back({text(row, "item_id"), text(row, "media_source_id"), textOrNull(row, "subtitles_json")});
  }
  for (const auto& item : complete) {
    bool touched = false;
    // Snapshot absent, affiche de série manquante ou version antérieure : un re-snapshot
    // complet répare tout, et saute ce qui est déjà en place.
    if (const auto spec = getSpec(db, item.itemId)) {
      const bool seriesPosterMissing = spec->seriesId && !seriesPrimaryExists(volume, item.itemId);
      const bool versionStale = metaVersion(db, item.itemId) < kCurrentMetaVersion;
      if (!snapshotExists(volume, item.itemId) || seriesPosterMissing || versionStale) {
        try {
          co_await snapshot(fetchBytes, db, serverUrl, volume, *spec, nowMs);
          touched = true;
        } catch (...) {
          // Non réparé ce tour-ci ; on continue avec les suivants.
        }
      }
    }
    // Segments pris pendant une analyse en cours : redemandés tant qu'elle n'a pas abouti.
    if (!touched && segmentsNeedRefresh(volume, item.itemId)) {
      touched = co_await fetchSegments(fetchBytes, serverUrl, volume, item.itemId);
    }
    // Trickplay manquant — le marqueur `trickplay.none` évite de redemander à chaque démarrage.
    if (!trickplayExists(volume, item.itemId) && !trickplayNoneRecently(volume, item.itemId, nowMs)) {
      const auto itemJson =
          co_await fetch(fetchBytes, serverUrl + "/api/jellyfin/Items/" + item.itemId + "?fields=Trickplay", kMaxJsonBytes);
      if (itemJson) {
        const std::string msrc = firstMediaSourceId(db, item.itemId).value_or(item.itemId);
        const int64_t sheets = co_await fetchTrickplay(fetchBytes, serverUrl, volume, item.itemId, msrc, *itemJson, nowMs);
        touched = touched || sheets > 0;
      }
    }
    if (item.subtitlesJson) {
      const auto specs = parseSpecs(*item.subtitlesJson);
      if (!specs.empty()) {
        const int64_t fetched =
            co_await fetchSubtitles(fetchBytes, serverUrl, volume, item.itemId, item.mediaSourceId, specs);
        // Le compte se recale à chaque passage : ce qui manquait au transfert arrive souvent ici.
        setSubtitlesDone(db, item.itemId, item.mediaSourceId, fetched);
        touched = touched || fetched > 0;
      }
    }
    if (touched) ++healed;
  }
  // Titres de musique complets sans pochette sur le disque (jamais posée, ou disparue).
  std::vector<std::string> covers;
  for (const Row& row : db.prepare(
                              "SELECT DISTINCT m.item_id, m.cover_rel FROM music_meta m JOIN files f ON f.item_id = m.item_id\n"
                              "       WHERE f.status = 'complete' AND m.artwork_path IS NOT NULL")
                            .all()) {
    const auto rel = textOrNull(row, "cover_rel");
    if (!rel || !mediaFileExists(volume, *rel)) covers.push_back(text(row, "item_id"));
  }
  for (const auto& itemId : covers) {
    bool ok = false;
    try {
      ok = co_await fetchMusicCover(fetchBytes, db, serverUrl, volume, itemId, fetchPublic);
    } catch (...) {
    }
    if (ok) ++healed;
  }
  co_return healed;
}

}  // namespace tentacle::offline
