#pragma once
// Le moteur de mise à jour, commun aux trois systèmes : vérifier le manifeste signé,
// décider (decision.h), télécharger, vérifier l'empreinte, préparer, appliquer au
// redémarrage, surveiller la période d'essai. Tout sur le fil principal, sans blocage :
// le lourd passe par Platform::background.

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "update/decision.h"
#include "update/manifest.h"
#include "update/platform.h"
#include "update/state.h"

namespace tentacle::update {

struct EngineConfig {
  std::string feedUrl;
  std::string channel = "stable";
  std::vector<TrustedKey> keys;
  bool allowLoopbackHttp = false;  // banc local seulement (flux sur 127.0.0.1)
  int64_t firstCheckDelayMs = 8000;
  int64_t checkIntervalMs = 6LL * 3600 * 1000;
  int64_t retryDelayMs = 5LL * 60 * 1000;      // premier nouvel essai ; double ensuite
  int64_t maxRetryDelayMs = 6LL * 3600 * 1000;  // plafond de l'attente exponentielle
  int64_t snoozeSeconds = 24 * 3600;  // « Plus tard » : rappel le lendemain
  size_t maxManifestBytes = 256 * 1024;
  int probationLaunches = 2;  // lancements ratés tolérés avant le retour arrière
};

class Engine {
 public:
  using Json = nlohmann::json;
  using Emit = std::function<void(const Json& snapshot)>;

  Engine(Platform& platform, EngineConfig config, Emit emit);

  // Relit l'état, traite la période d'essai, programme le premier contrôle.
  // Faux si l'app doit s'arrêter (retour arrière lancé).
  bool start();
  void checkNow();
  Json snapshot() const;

  // Actions de la page.
  std::string restartNow();  // « Redémarrer pour mettre à jour » (erreur vide = parti)
  void later();              // « Plus tard »
  void muteUntilNextMajor(); // « Ne plus m'avertir jusqu'à la prochaine grosse mise à jour »
  void markHealthy();        // la nouvelle version tient (10 s après l'ouverture de la fenêtre)
  void dismissNotice();      // l'annonce du retour arrière a été lue
  // Fermeture PROPRE : la version en essai a donc fonctionné (bonne santé), et une mise à jour
  // prête s'applique sans bruit.
  void onQuit();

  Phase phase() const { return phase_; }
  const Decision& decision() const { return decision_; }
  const DeviceState& state() const { return state_; }

 private:
  void scheduleCheck(int64_t delayMs, bool replace = false);
  void onManifest(std::optional<std::string> body, std::string error);
  void startDownload();
  void onDownloaded(std::string error, bool network);
  void onVerified(bool ok);
  void onStaged(std::string error, std::string staged, Version version);
  void fail(std::string code, bool retry);
  void dropStaged();
  void checkProbation();
  void redecide();
  void persist();
  void publish();
  std::string path(const char* name) const;

  Platform& p_;
  EngineConfig cfg_;
  Emit emit_;
  Version current_;
  bool enabled_ = false;
  DeviceState state_;
  std::optional<Manifest> manifest_;
  Decision decision_;
  Phase phase_ = Phase::Idle;
  double progress_ = -1;
  std::string error_;
  std::string archive_, staged_;
  std::optional<Version> stagedVersion_;  // la version RÉELLEMENT préparée (pas celle du dernier manifeste)
  bool checking_ = false;   // un contrôle en vol ne masque pas la phase (prête reste prête)
  int failures_ = 0;        // échecs pour la version visée : attente exponentielle, plus de voile
  std::string rolledBackNotice_;  // « la X n'a pas démarré, retour à la Y »
  bool applied_ = false;
  bool checkScheduled_ = false;
  uint64_t timerToken_ = 0;
  uint64_t generation_ = 0;  // annule les rappels d'un téléchargement abandonné
};

}  // namespace tentacle::update
