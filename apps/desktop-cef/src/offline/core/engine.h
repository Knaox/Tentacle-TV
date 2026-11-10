#pragma once
// L'orchestrateur des transferts — `core/engine.ts` (+ `engineDeps.ts`, `engineWork.ts`,
// `engineEnd.ts`, `engineGestures.ts`, `engineHold.ts`, `networkRetry.ts`, `musicLane.ts`,
// `preparePhase.ts`, `worker.ts`). Un film à la fois, trois titres de musique (bureau), FIFO,
// reprise au démarrage, pause, reprise, annulation, relances.
//
// Tout vit sur le fil hors ligne : les transferts sont des coroutines, la table des actifs une
// `map`, les bascules des booléens. Les identifiants de connexion vivent EN MÉMOIRE seulement.

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/sidecars.h"
#include "offline/core/store.h"
#include "offline/core/transfer.h"

namespace tentacle::offline {

struct Creds {
  std::string serverUrl, token;
};

/// La préparation tenue par le serveur (`offline.serverPrepare`) : le bureau d'Electron ne la
/// demande pas (Allégé tiré en direct) ; le mécanisme est porté, la dépendance reste vide.
struct ServerPrepare {
  std::string tag;
};

/// Ce qui tient la plateforme au-delà des transferts en vol (`engineHold.ts`).
struct HoldState {
  bool transferring = false, awaitingRetry = false, awaitingServer = false;
  bool operator==(const HoldState&) const = default;
};

struct EngineDeps {
  Database* db = nullptr;
  std::function<Volume()> volume;  // relu à chaque usage : la racine peut changer
  TransferDriver* driver = nullptr;
  Scheduler* scheduler = nullptr;
  std::function<FetchBytes(const std::string& token)> makeFetcher;
  std::function<FetchBytes()> makePublicFetcher;  // vide : pochettes d'ailleurs non gardées
  std::function<void(const std::string& event, const nlohmann::json& payload)> emit;
  std::function<int64_t()> now;
  std::optional<std::vector<int64_t>> retryDelaysMs;         // vide : `kRetryDelaysMs`
  std::optional<std::vector<int64_t>> networkRetryDelaysMs;  // vide : `kNetworkRetryDelaysMs`
  std::function<void(const std::string& context, const std::string& error)> onUnexpected;
  std::function<void(const Creds&)> onStarted;
  std::function<void(bool busy)> onBusy;  // aux SEULES transitions
  std::function<void(const HoldState&)> onHeld;
  std::function<bool()> canTransfer;          // vide (bureau) : toujours oui
  std::function<int64_t()> musicParallelLimit;  // bureau : 3
  std::function<std::optional<ServerPrepare>()> serverPrepare;  // vide (bureau d'Electron)
};

/// L'URL du média selon la variante (`worker.ts`).
std::string mediaUrl(const std::string& serverUrl, const FileRow& file, const std::optional<ServerPrepare>& prepare = {});

class DownloadEngine {
 public:
  explicit DownloadEngine(EngineDeps deps);
  ~DownloadEngine();

  bool isActive(int64_t fileId) const { return active_.count(fileId) > 0; }
  HoldState held() const { return hold_; }
  /// En vol + en file + en attente d'une relance ; 0 sans identifiants (rien ne bougerait).
  int64_t pending();
  void notifyChanged();
  /// Démarrage ou reconnexion : identifiants, file normalisée, relance.
  void start(const Creds& creds);
  void setCreds(const Creds& creds) { creds_ = creds; }
  /// PASSAGE OBLIGÉ de toute variation d'activité.
  void pump();
  void sweepRetries();
  void pause(int64_t fileId);
  void resume(int64_t fileId);
  /// Les pauses SYSTÈME (réveil de veille) ; les explicites ne bougent pas.
  void resumeSystemPauses();
  void suspendForSystem();
  void cancel(int64_t fileId);
  /// La fin effective d'un transfert (une suppression ne court pas contre un worker).
  Task<void> waitNotActive(int64_t fileId, int64_t timeoutMs);

 private:
  void startWhatCanRun();
  void updateActivity();
  void armRetries();
  Task<void> work(Creds creds, int64_t fileId, std::shared_ptr<TransferFlags> flags);
  void finish(int64_t fileId, const TransferEnd& end, bool moved);

  EngineDeps deps_;
  std::optional<Creds> creds_;
  std::map<int64_t, std::shared_ptr<TransferFlags>> active_;
  std::set<int64_t> activeMusic_;
  bool busy_ = false;
  bool systemSuspended_ = false;
  // Relances : un seul minuteur, calé sur la PROCHAINE échéance (une génération l'annule).
  uint64_t retryGeneration_ = 0;
  // Coupures réseau d'affilée par fichier (en mémoire : un redémarrage repart de la 1re marche).
  std::map<int64_t, int64_t> networkAttempts_;
  // Maintien : fichiers dont la DERNIÈRE fin est une attente demandée par le serveur.
  std::set<int64_t> serverWaits_;
  HoldState hold_;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::offline
