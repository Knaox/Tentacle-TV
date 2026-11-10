// La fin d'un transfert en statut (`engineEnd.ts`), les gestes (`engineGestures.ts`), les
// places (`musicLane.ts`).

#include "offline/core/engine_work.h"
#include "offline/core/queue.h"

namespace tentacle::offline {

void applyEnd(Database& db, int64_t fileId, const TransferEnd& end, const EndContext& ctx) {
  const int64_t now = ctx.nowMs;
  if (end.kind != TransferEnd::Kind::Canceled) {
    const auto file = getFile(db, fileId);
    if (file && file->status == "canceled") return;
  }
  switch (end.kind) {
    case TransferEnd::Kind::Complete:
      setBytesDone(db, fileId, end.finalSize, now);
      setStatus(db, fileId, "complete", std::nullopt, now);
      clearRetry(db, fileId);
      break;
    case TransferEnd::Kind::Paused:
      setBytesDone(db, fileId, end.bytesDone, now);
      // Une pause SYSTÈME qui aboutit APRÈS le retour des conditions repart d'elle-même.
      if (!isPausedByUser(db, fileId) && !ctx.systemSuspended && !(ctx.canTransfer && !ctx.canTransfer())) {
        setStatus(db, fileId, "queued", std::nullopt, now);
      } else {
        setStatus(db, fileId, "paused", std::nullopt, now);
      }
      break;
    case TransferEnd::Kind::Canceled:
      setBytesDone(db, fileId, 0, now);
      setStatus(db, fileId, "canceled", std::nullopt, now);
      clearRetry(db, fileId);
      break;
    case TransferEnd::Kind::Failed:
      setBytesDone(db, fileId, end.bytesDone, now);
      if (end.code == "network") {
        // Coupure réseau = pause SYSTÈME, qui se relance d'elle-même.
        setPausedByUser(db, fileId, false);
        setStatus(db, fileId, "paused", std::nullopt, now);
        scheduleNetworkRetry(db, fileId, ctx.networkRetryAt, now);
      } else {
        setStatus(db, fileId, "error", end.code, now);
        const bool scheduled = recordFailure(db, fileId, end.code, ctx.retryDelaysMs, now);
        // Une finalisation qui a épuisé ses essais : la phase tombe.
        if (end.code == "finalize" && !scheduled && !ctx.retryDelaysMs.empty()) setPhase(db, fileId, std::nullopt, now);
      }
      break;
  }
}

void pauseFile(Database& db, int64_t fileId, TransferFlags* flags, int64_t nowMs) {
  setPausedByUser(db, fileId, true);
  clearRetry(db, fileId);  // une pause n'est jamais une tentative
  if (flags != nullptr) {
    flags->setPause(true);
    return;
  }
  const auto file = getFile(db, fileId);
  if (file && file->status == "queued") setStatus(db, fileId, "paused", std::nullopt, nowMs);
}

void resumeFile(Database& db, int64_t fileId, int64_t nowMs) {
  const auto file = getFile(db, fileId);
  if (!file || (file->status != "paused" && file->status != "error")) return;
  setPausedByUser(db, fileId, false);
  setStatus(db, fileId, "queued", std::nullopt, nowMs);
  clearRetry(db, fileId);
}

void cancelFile(Database& db, const Volume& volume, int64_t fileId, TransferFlags* flags, int64_t nowMs) {
  const auto file = getFile(db, fileId);
  if (!file) return;
  // En vol : la bascule (le transfert nettoie son `.part` seul) ; sinon le fichier part ici.
  if (flags != nullptr) flags->setCancel(true);
  else removeMediaFile(volume, file->relPath);
  // L'intention est écrite TOUT DE SUITE : une app tuée entre-temps ne la referait pas partir.
  setBytesDone(db, fileId, 0, nowMs);
  setPhase(db, fileId, std::nullopt, nowMs);
  setStatus(db, fileId, "canceled", std::nullopt, nowMs);
  clearRetry(db, fileId);
}

bool mayStart(bool nextIsMusic, int64_t activeTotal, int64_t activeMusic, int64_t laneAll, int64_t laneMusic) {
  if (nextIsMusic && laneMusic > laneAll) return activeTotal == activeMusic && activeMusic < laneMusic;
  return activeTotal < laneAll;
}

}  // namespace tentacle::offline
