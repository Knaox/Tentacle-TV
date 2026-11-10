#pragma once
// Un essai de transfert (`engineWork.ts`) et la traduction de sa fin en statut (`engineEnd.ts`).

#include <functional>
#include <memory>
#include <optional>
#include <vector>

#include "offline/core/engine.h"

namespace tentacle::offline {

/// `files.phase` d'un titre que le serveur PRÉPARE (musique : `source_path`) — `preparePhase.ts`.
inline constexpr const char* kPreparePhase = "prepare";

struct WorkerHooks {
  std::function<void(int64_t bytes)> onProgress;
  std::function<void(int64_t total)> onExpected;
  std::function<void(int status)> onResponse;
};

struct Attempt {
  TransferEnd end;
  bool moved = false;  // des octets reçus pendant CET essai (la relance repart de la 1re marche)
};

/// Joue l'essai ; `changed` : la page doit relire. Ne lève jamais.
Task<Attempt> runAttempt(const EngineDeps& deps, Creds creds, int64_t fileId, std::shared_ptr<TransferFlags> flags,
                         std::function<void()> changed);

struct EndContext {
  int64_t nowMs = 0;
  bool systemSuspended = false;
  std::function<bool()> canTransfer;
  std::vector<int64_t> retryDelaysMs;
  std::optional<int64_t> networkRetryAt;
};

/// Une ligne DÉJÀ annulée ne se laisse pas recouvrir (l'intention a été écrite au geste).
void applyEnd(Database& db, int64_t fileId, const TransferEnd& end, const EndContext& ctx);

/// Les gestes (`engineGestures.ts`) : en vol, une bascule ; en file, la base directement.
void pauseFile(Database& db, int64_t fileId, TransferFlags* flags, int64_t nowMs);
void resumeFile(Database& db, int64_t fileId, int64_t nowMs);
void cancelFile(Database& db, const Volume& volume, int64_t fileId, TransferFlags* flags, int64_t nowMs);

/// Les places (`musicLane.ts`) : jamais un film à côté d'un titre, ni l'inverse.
bool mayStart(bool nextIsMusic, int64_t activeTotal, int64_t activeMusic, int64_t laneAll, int64_t laneMusic);

}  // namespace tentacle::offline
