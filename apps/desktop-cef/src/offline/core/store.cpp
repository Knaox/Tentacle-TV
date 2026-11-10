#include "offline/core/store.h"

#include <stdexcept>

#include "offline/core/rows.h"
#include "offline/core/schema.h"

namespace tentacle::offline {

const char* const kFileCols =
    "files.id, files.item_id, files.media_source_id, files.variant,\n"
    "   files.preset, files.rel_path, files.expected_size, files.bytes_done, files.status,\n"
    "   files.error_code, files.audio_stream_index, files.burn_subtitle_index, files.subtitles_json,\n"
    "   files.retry_count, files.last_error_at, files.next_retry_at, files.phase,\n"
    "   files.subtitles_done, files.source_path";

namespace {

std::string checked(const Row& row, const char* column, std::initializer_list<const char*> allowed) {
  std::string value = text(row, column);
  for (const char* candidate : allowed) {
    if (value == candidate) return value;
  }
  throw std::runtime_error(std::string("colonne ") + column + " : valeur inattendue " + value);
}

}  // namespace

FileRow mapFileRow(const Row& row) {
  FileRow f;
  f.id = integer(row, "id");
  f.itemId = text(row, "item_id");
  f.mediaSourceId = text(row, "media_source_id");
  f.variant = checked(row, "variant", {"original", "light"});
  f.preset = textOrNull(row, "preset");
  f.relPath = text(row, "rel_path");
  f.expectedSize = integerOrNull(row, "expected_size");
  f.bytesDone = integer(row, "bytes_done");
  f.status = checked(row, "status", {"queued", "downloading", "paused", "complete", "error", "canceled"});
  f.errorCode = textOrNull(row, "error_code");
  f.audioStreamIndex = integerOrNull(row, "audio_stream_index");
  f.burnSubtitleIndex = integerOrNull(row, "burn_subtitle_index");
  f.subtitlesJson = textOrNull(row, "subtitles_json");
  f.retryCount = integer(row, "retry_count");
  f.lastErrorAt = integerOrNull(row, "last_error_at");
  f.nextRetryAt = integerOrNull(row, "next_retry_at");
  f.phase = textOrNull(row, "phase");
  f.subtitlesDone = integerOrNull(row, "subtitles_done");
  f.sourcePath = textOrNull(row, "source_path");
  return f;
}

Json publicFile(const FileRow& f) {
  return {
      {"id", f.id},
      {"itemId", f.itemId},
      {"mediaSourceId", f.mediaSourceId},
      {"variant", f.variant},
      {"preset", opt(f.preset)},
      {"relPath", f.relPath},
      {"expectedSize", opt(f.expectedSize)},
      {"bytesDone", f.bytesDone},
      {"status", f.status},
      {"errorCode", opt(f.errorCode)},
      {"audioStreamIndex", opt(f.audioStreamIndex)},
      {"burnSubtitleIndex", opt(f.burnSubtitleIndex)},
      {"retryCount", f.retryCount},
      {"lastErrorAt", opt(f.lastErrorAt)},
      {"nextRetryAt", opt(f.nextRetryAt)},
      {"phase", opt(f.phase)},
      {"subtitlesDone", opt(f.subtitlesDone)},
      {"sourcePath", opt(f.sourcePath)},
  };
}

void setSubtitlesDone(Database& db, const std::string& itemId, const std::string& mediaSourceId, int64_t done) {
  // Les side-cars appartiennent au COUPLE item / source : toutes les variantes les partagent.
  db.prepare("UPDATE files SET subtitles_done = ? WHERE item_id = ? AND media_source_id = ?")
      .run(done, itemId, mediaSourceId);
}

void setLightParams(Database& db, int64_t fileId, const std::optional<int64_t>& audioStreamIndex,
                    const std::optional<int64_t>& burnSubtitleIndex, const std::optional<std::string>& subtitlesJson) {
  db.prepare(
        "UPDATE files SET audio_stream_index = ?, burn_subtitle_index = ?, subtitles_json = ?\n"
        "     WHERE id = ?")
      .run(audioStreamIndex, burnSubtitleIndex, subtitlesJson, fileId);
}

std::optional<FoundFile> findFile(Database& db, const FileIdentity& id) {
  const auto row = db.prepare(
                         "SELECT id, status FROM files\n"
                         "       WHERE item_id = ? AND media_source_id = ? AND variant = ?\n"
                         "         AND COALESCE(preset, '') = COALESCE(?, '')")
                       .get(id.itemId, id.mediaSourceId, id.variant, id.preset);
  if (!row) return std::nullopt;
  return FoundFile{integer(*row, "id"), text(*row, "status")};
}

ClaimOutcome claimOrCreateFile(Database& db, const ClaimSpec& spec) {
  return transaction(db, [&]() -> ClaimOutcome {
    const auto existing = findFile(db, spec.identity);
    ClaimOutcome outcome{0, false};
    if (existing) {
      if (existing->status == "canceled") {
        db.prepare(
              "UPDATE files SET status = 'queued', bytes_done = 0, error_code = NULL,\n"
              "                  paused_by_user = 0, retry_count = 0, next_retry_at = NULL,\n"
              "                  phase = NULL, expected_size = ?, updated_at = ? WHERE id = ?")
            .run(spec.expectedSize, spec.nowMs, existing->id);
      }
      outcome = {existing->id, false};
    } else {
      const RunResult inserted =
          db.prepare(
                "INSERT INTO files (item_id, media_source_id, variant, preset, rel_path,\n"
                "                              expected_size, bytes_done, status, created_at, updated_at)\n"
                "           VALUES (?, ?, ?, ?, ?, ?, 0, 'queued', ?, ?)")
              .run(spec.identity.itemId, spec.identity.mediaSourceId, spec.identity.variant, spec.identity.preset,
                   spec.relPath, spec.expectedSize, spec.nowMs, spec.nowMs);
      outcome = {inserted.lastInsertRowid, true};
    }
    db.prepare(
          "INSERT INTO claims (jellyfin_user_id, file_id, auto_delete_after_watch, created_at)\n"
          "       VALUES (?, ?, ?, ?)\n"
          "       ON CONFLICT(jellyfin_user_id, file_id) DO NOTHING")
        .run(spec.userId, outcome.fileId, bit(spec.autoDeleteAfterWatch), spec.nowMs);
    return outcome;
  });
}

DeleteOutcome deleteClaim(Database& db, const Volume& volume, const std::string& userId, int64_t fileId) {
  struct Doomed {
    std::string itemId;
    std::string relPath;
    bool metaOrphan;
  };
  const std::optional<Doomed> doomed = transaction(db, [&]() -> std::optional<Doomed> {
    const RunResult removed = db.prepare("DELETE FROM claims WHERE jellyfin_user_id = ? AND file_id = ?").run(userId, fileId);
    if (removed.changes == 0) return std::nullopt;
    const auto remaining = db.prepare("SELECT COUNT(*) AS n FROM claims WHERE file_id = ?").get(fileId);
    if (remaining && integer(*remaining, "n") > 0) return std::nullopt;
    const auto file = db.prepare("SELECT item_id, rel_path FROM files WHERE id = ?").get(fileId);
    if (!file) return std::nullopt;
    Doomed d{text(*file, "item_id"), text(*file, "rel_path"), false};
    db.prepare("DELETE FROM files WHERE id = ?").run(fileId);
    const auto siblings = db.prepare("SELECT COUNT(*) AS n FROM files WHERE item_id = ?").get(d.itemId);
    d.metaOrphan = siblings && integer(*siblings, "n") == 0;
    if (d.metaOrphan) {
      db.prepare("DELETE FROM item_meta WHERE item_id = ?").run(d.itemId);
      // Un titre de musique (v11) : sa fiche part avec son dernier fichier.
      db.prepare("DELETE FROM music_meta WHERE item_id = ?").run(d.itemId);
    }
    return d;
  });
  if (!doomed) return {};
  removeMediaFile(volume, doomed->relPath);
  if (doomed->metaOrphan) {
    removeItemMetaDir(volume, doomed->itemId);
    removeItemMediaDir(volume, doomed->itemId);
  }
  return {true, doomed->metaOrphan};
}

Json toJson(const DeleteOutcome& outcome) {
  return {{"fileDeleted", outcome.fileDeleted}, {"metaDeleted", outcome.metaDeleted}};
}

}  // namespace tentacle::offline
