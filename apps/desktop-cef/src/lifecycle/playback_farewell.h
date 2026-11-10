#pragma once
// Fermer l'application en pleine lecture doit ARRÊTER la lecture chez Jellyfin
// (`apps/desktop-electron/src/main/playbackFarewell.ts`, porté à l'identique).
//
// La page annonçait l'arrêt dans son `beforeunload`, par `sendBeacon` : depuis l'origine
// `tentacle://app`, ce beacon (JSON, donc préflighté) ne part jamais. Tous les reports de
// lecture passent par le relais natif `jellyfin_session_post` (axe reseau) : il les montre ici
// AVANT de les envoyer. À la sortie, l'arrêt de ce qui reste ouvert est posté par le natif, et
// les envois en vol sont attendus — 1,5 s au plus : une app qui ne se ferme plus coûte plus
// cher qu'un arrêt perdu. Rien ne peut être fait pour un plantage (filet côté serveur).
//
// Pur : ni CEF ni réseau. L'horloge, l'envoi et le minuteur sont injectés.

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "lifecycle/lifecycle.h"

namespace tentacle::lifecycle {

/// Au-delà, la sortie n'attend plus Jellyfin (même échéance que la séquence de fermeture).
inline constexpr int64_t kFarewellDeadlineMs = 1'500;
/// Au-delà, on cesse d'extrapoler la position depuis le dernier report (page muette).
inline constexpr int64_t kMaxExtrapolationMs = 30'000;

class PlaybackFarewell {
 public:
  using Clock = std::function<int64_t()>;
  /// Un arrêt à poster ; `done` une fois (succès ou échec). Une exception vaut un échec.
  using Send = std::function<void(const FarewellStop& stop, std::function<void()> done)>;
  /// Rappelle `fn` dans `ms` millisecondes (minuteur de l'échéance).
  using After = std::function<void(int64_t ms, std::function<void()> fn)>;

  explicit PlaybackFarewell(Clock now) : now_(std::move(now)) {}

  /// Chaque report relayé passe ici, AVANT son envoi.
  void note(const SessionPost& post);
  /// Un envoi en cours : la sortie l'attendra. Rend son jeton, à rendre par `release`.
  uint64_t track();
  void release(uint64_t token);
  /// Reste-t-il quelque chose à dire à Jellyfin avant de partir ?
  bool pending() const { return !open_.empty() || !inFlight_.empty(); }
  /// Les arrêts à poster pour les lectures encore ouvertes, position extrapolée.
  std::vector<FarewellStop> stops() const;
  /// Poste l'arrêt de ce qui reste ouvert et attend les envois en vol — au plus `deadlineMs`.
  /// `finished` est rappelée UNE fois, quoi qu'il arrive (jamais d'erreur : la sortie suit).
  void farewell(const Send& send, int64_t deadlineMs, const After& after,
                std::function<void()> finished);

 private:
  struct Open {
    std::string baseUrl, token, authHeader, itemId;
    std::optional<std::string> mediaSourceId, playSessionId;
    double positionTicks = 0;
    bool isPaused = false;
    int64_t reportedAt = 0;
  };
  struct Wait;  // une sortie en cours (farewell)
  Clock now_;
  std::map<std::string, Open> open_;  // clé : session de lecture, à défaut le média
  std::set<uint64_t> inFlight_;
  uint64_t nextToken_ = 1;
  std::vector<std::shared_ptr<Wait>> waits_;
};

}  // namespace tentacle::lifecycle
