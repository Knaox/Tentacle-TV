#pragma once
// Le transfert d'UN fichier — `core/transfer.ts` (la POLITIQUE : reprise, `.part`, intégrité,
// classification, arrêt du transcodage) et le contrat de son PILOTE (`adapters.ts`), qui lit
// le flux HTTP et l'écrit (`glue/stream_driver.cpp` : CefURLRequest + écritures
// positionnelles). Tant que le fichier porte `.part`, rien ne le présente comme lisible.

#include <cstdint>
#include <filesystem>
#include <functional>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "offline/core/paths.h"
#include "offline/core/task.h"

namespace tentacle::offline {

using HeaderList = std::vector<std::pair<std::string, std::string>>;
/// Un en-tête de réponse par nom (insensible à la casse), ou rien.
using HeaderFn = std::function<std::optional<std::string>(const std::string& name)>;
HeaderFn headerLookup(HeaderList headers);

/// Bascules posées par le moteur, OBSERVABLES : un flux figé doit pouvoir être coupé sans
/// attendre un bloc qui ne viendra pas.
class TransferFlags {
 public:
  bool cancel() const { return cancel_; }
  bool pause() const { return pause_; }
  void setCancel(bool v);
  void setPause(bool v);
  /// Rend le désabonnement.
  std::function<void()> subscribe(std::function<void()> listener);

 private:
  void notify();
  bool cancel_ = false;
  bool pause_ = false;
  int next_ = 0;
  std::map<int, std::function<void()>> listeners_;
};

/// Fin d'un transfert. Codes STABLES, lus par l'interface : network, disk-full, integrity,
/// unavailable, io, finalize, audio, unexpected.
struct TransferEnd {
  enum class Kind { Complete, Paused, Canceled, Failed } kind = Kind::Failed;
  int64_t finalSize = 0;  // Complete
  int64_t bytesDone = 0;  // Paused, Failed
  std::string code;       // Failed
  std::optional<int64_t> retryAfterMs;  // 503 + Retry-After : relance à l'heure dite
  static TransferEnd complete(int64_t size) { return {Kind::Complete, size, 0, "", std::nullopt}; }
  static TransferEnd paused(int64_t bytes) { return {Kind::Paused, 0, bytes, "", std::nullopt}; }
  static TransferEnd canceled() { return {Kind::Canceled, 0, 0, "", std::nullopt}; }
  static TransferEnd failed(std::string code, int64_t bytes, std::optional<int64_t> after = std::nullopt) {
    return {Kind::Failed, 0, bytes, std::move(code), after};
  }
};

// --- Le pilote ------------------------------------------------------------------------------

struct TransferRequest {
  std::string url;
  HeaderList headers;  // jamais `Range` : c'est le pilote qui la pose pour `resumeFrom > 0`
  std::filesystem::path partPath;
  int64_t resumeFrom = 0;
  std::shared_ptr<TransferFlags> signal;
  std::function<void(int64_t bytesOnDisk)> onBytes;  // total cumulé, brut
  std::function<void(int status, HeaderFn header)> onHeaders;
  std::function<void(int64_t total)> onTotal;
};

struct TransferOutcome {
  enum class Kind { Done, Paused, Canceled, Failed } kind = Kind::Failed;
  int status = 0;
  HeaderFn header;
  std::string cause;  // network | disk-full | io | range-ignored
  int64_t bytesKnown = 0;
};

class TransferDriver {
 public:
  virtual ~TransferDriver() = default;
  /// Contrat de `adapters.ts` : Range posée par le pilote ; un 200 à une reprise → repartir
  /// de zéro ; sur un statut ≥ 400 rien n'est écrit ; `onBytes` cumulé ; bascules observées.
  virtual void download(TransferRequest request, std::function<void(TransferOutcome)> done) = 0;
  /// Arrêt de transcodage (et libération d'une préparation), best-effort : ne lève jamais.
  virtual void stopTranscode(std::string url, HeaderList headers, std::function<void()> done) = 0;
};

// --- La politique ---------------------------------------------------------------------------

struct TranscodeSession {
  std::string playSessionId, deviceId;
};

struct TransferJob {
  std::string url;
  std::string token;  // en EN-TÊTE, jamais en requête, jamais sur le disque
  std::filesystem::path finalPath;
  std::string variant;
  std::optional<int64_t> expectedSize;
  std::string serverUrl;
  std::optional<TranscodeSession> transcodeSession;
  std::optional<bool> resumable;  // absent : l'Original seul
  std::optional<std::string> releaseUrl;
};

struct TransferHooks {
  std::function<void(int64_t)> onExpected;
  std::function<void(int)> onResponse;
  std::function<void(const std::string& context, const std::string& error)> onUnexpected;
};

/// Le transfert, jusqu'au bout ; `onProgress` est déjà étranglé (4 Mio ou 700 ms). Ne lève
/// jamais : toute sortie est un `TransferEnd`.
Task<TransferEnd> runTransfer(TransferDriver& driver, Volume volume, TransferJob job, std::shared_ptr<TransferFlags> flags,
                              std::function<void(int64_t)> onProgress, std::function<int64_t()> now,
                              TransferHooks hooks = {});

/// Le `Retry-After` d'un serveur qui PRÉPARE (503) : secondes ou date HTTP, borné à
/// [1 s, 6 h] ; rien pour tout autre statut.
std::optional<int64_t> serverWaitMs(int status, const HeaderFn& header, int64_t nowMs);
/// Le total annoncé : fin de `Content-Range` d'un 206, sinon `Content-Length` + reprise.
std::optional<int64_t> announcedTotal(int status, const HeaderFn& header, int64_t from);

}  // namespace tentacle::offline
