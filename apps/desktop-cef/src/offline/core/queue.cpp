#include "offline/core/queue.h"

#include <algorithm>

#include "offline/core/rows.h"

namespace tentacle::offline {
namespace {

int64_t count(Database& db, const char* sql) {
  const auto row = db.prepare(sql).get();
  return row ? integer(*row, "n") : 0;
}

}  // namespace

std::optional<FileRow> getFile(Database& db, int64_t fileId) {
  const auto row = db.prepare(std::string("SELECT ") + kFileCols + " FROM files WHERE files.id = ?").get(fileId);
  return row ? std::optional<FileRow>(mapFileRow(*row)) : std::nullopt;
}

std::optional<FileRow> nextQueued(Database& db) {
  const auto row = db.prepare(std::string("SELECT ") + kFileCols +
                              " FROM files\n"
                              "       WHERE files.status = 'queued'\n"
                              "       ORDER BY files.created_at ASC, files.id ASC LIMIT 1")
                       .get();
  return row ? std::optional<FileRow>(mapFileRow(*row)) : std::nullopt;
}

void setStatus(Database& db, int64_t fileId, const std::string& status, const std::optional<std::string>& errorCode,
               int64_t nowMs) {
  db.prepare("UPDATE files SET status = ?, error_code = ?, updated_at = ? WHERE id = ?").run(status, errorCode, nowMs, fileId);
}

void setPausedByUser(Database& db, int64_t fileId, bool byUser) {
  db.prepare("UPDATE files SET paused_by_user = ? WHERE id = ?").run(bit(byUser), fileId);
}

bool isPausedByUser(Database& db, int64_t fileId) {
  const auto row = db.prepare("SELECT paused_by_user FROM files WHERE id = ?").get(fileId);
  return row && integer(*row, "paused_by_user") != 0;
}

void setPhase(Database& db, int64_t fileId, const std::optional<std::string>& phase, int64_t nowMs) {
  db.prepare("UPDATE files SET phase = ?, updated_at = ? WHERE id = ?").run(phase, nowMs, fileId);
}

void setExpectedSize(Database& db, int64_t fileId, int64_t bytes, int64_t nowMs) {
  db.prepare("UPDATE files SET expected_size = ?, updated_at = ? WHERE id = ?").run(bytes, nowMs, fileId);
}

void setBytesDone(Database& db, int64_t fileId, int64_t bytes, int64_t nowMs) {
  db.prepare("UPDATE files SET bytes_done = ?, updated_at = ? WHERE id = ?").run(bytes, nowMs, fileId);
}

void normalizeOnEngineStart(Database& db, int64_t nowMs) {
  db.prepare(
        "UPDATE files SET status = 'queued', next_retry_at = NULL, updated_at = ?\n"
        "     WHERE status = 'downloading'\n"
        "        OR (status = 'paused' AND paused_by_user = 0)")
      .run(nowMs);
}

int64_t requeueSystemPauses(Database& db, int64_t nowMs) {
  return db.prepare(
               "UPDATE files SET status = 'queued', next_retry_at = NULL, updated_at = ?\n"
               "       WHERE status = 'paused' AND paused_by_user = 0")
      .run(nowMs)
      .changes;
}

int64_t suspendQueued(Database& db, int64_t nowMs) {
  return db.prepare(
               "UPDATE files SET status = 'paused', paused_by_user = 0, updated_at = ?\n"
               "       WHERE status = 'queued'")
      .run(nowMs)
      .changes;
}

int64_t countQueued(Database& db) { return count(db, "SELECT COUNT(*) AS n FROM files WHERE status = 'queued'"); }

int64_t pendingBytes(Database& db) {
  return count(db,
               "SELECT COALESCE(SUM(MAX(COALESCE(expected_size, 0) - bytes_done, 0)), 0) AS n\n"
               "       FROM files WHERE status IN ('queued', 'downloading', 'paused')");
}

// --- Relances -------------------------------------------------------------------------------

const std::vector<int64_t> kRetryDelaysMs = {5000, 15000, 60000};
const std::vector<int64_t> kNetworkRetryDelaysMs = {5000, 15000, 30000, 60000, 120000, 300000};

std::optional<int64_t> networkRetryDelay(int64_t attempt, const std::vector<int64_t>& delays, int64_t immediate) {
  if (delays.empty()) return std::nullopt;
  if (std::max<int64_t>(0, attempt) < immediate) return 0;
  const auto index = std::min<int64_t>(std::max<int64_t>(0, attempt), static_cast<int64_t>(delays.size()) - 1);
  return delays[static_cast<size_t>(index)];
}

bool retryableCode(const std::string& code) { return code == "io" || code == "finalize" || code == "unexpected"; }

bool recordFailure(Database& db, int64_t fileId, const std::string& code, const std::vector<int64_t>& delays,
                   int64_t nowMs) {
  const auto row = db.prepare("SELECT retry_count FROM files WHERE id = ?").get(fileId);
  if (!row) return false;
  const int64_t attempt = integer(*row, "retry_count");
  std::optional<int64_t> delay;
  if (retryableCode(code) && attempt >= 0 && attempt < static_cast<int64_t>(delays.size())) {
    delay = delays[static_cast<size_t>(attempt)];
  }
  db.prepare(
        "UPDATE files SET retry_count = retry_count + 1, last_error_at = ?,\n"
        "            next_retry_at = ?, updated_at = ? WHERE id = ?")
      .run(nowMs, delay ? std::optional<int64_t>(nowMs + *delay) : std::nullopt, nowMs, fileId);
  return delay.has_value();
}

void scheduleNetworkRetry(Database& db, int64_t fileId, std::optional<int64_t> dueAt, int64_t nowMs) {
  db.prepare("UPDATE files SET next_retry_at = ?, last_error_at = ?, updated_at = ? WHERE id = ?")
      .run(dueAt, nowMs, nowMs, fileId);
}

void clearRetry(Database& db, int64_t fileId) {
  db.prepare("UPDATE files SET retry_count = 0, next_retry_at = NULL WHERE id = ?").run(fileId);
}

int64_t requeueDueRetries(Database& db, int64_t nowMs) {
  // Une pause de l'utilisateur n'a jamais d'échéance ; la condition l'exclut quand même. La
  // phase n'est PAS effacée : elle fera sauter le téléchargement d'un fichier déjà reçu.
  return db.prepare(
               "UPDATE files SET status = 'queued', error_code = NULL, next_retry_at = NULL,\n"
               "              paused_by_user = 0, updated_at = ?\n"
               "       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))\n"
               "         AND next_retry_at IS NOT NULL AND next_retry_at <= ?")
      .run(nowMs, nowMs)
      .changes;
}

std::optional<int64_t> nextRetryDueAt(Database& db) {
  const auto row = db.prepare(
                         "SELECT MIN(next_retry_at) AS due FROM files\n"
                         "       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))\n"
                         "         AND next_retry_at IS NOT NULL")
                       .get();
  return row ? integerOrNull(*row, "due") : std::nullopt;
}

int64_t countAwaitingRetry(Database& db) {
  return count(db,
               "SELECT COUNT(*) AS n FROM files\n"
               "       WHERE (status = 'error' OR (status = 'paused' AND paused_by_user = 0))\n"
               "         AND next_retry_at IS NOT NULL");
}

}  // namespace tentacle::offline
