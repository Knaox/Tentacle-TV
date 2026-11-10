#pragma once
// « Continuer en arrière-plan » : la fenêtre fermée pendant un transfert ne le coupe plus
// (`backgroundDrain.ts` d'Electron, porté à l'identique).
//
// Fermer la fenêtre (croix, Alt+F4, bouton rouge) laisse le PROCESSUS vivant — navigateur
// détruit — jusqu'à ce que la file soit vide, puis l'app se ferme d'elle-même. Quitter (Cmd+Q,
// menu) reste quitter : la garde de sortie pose sa question (quit_guard.h). Trois sorties :
// - la file est vide → quitter ;
// - plus rien ne bouge depuis `kDrainIdleGiveUpMs` (réseau coupé, serveur muet) → quitter : les
//   transferts reprendront au prochain lancement, là où ils en sont ;
// - on rouvre l'app (Dock, second lancement) → la RELANCER, jamais une fenêtre refabriquée dans
//   le même processus (l'état d'une session morte).
// La lecture (musique comprise) s'arrête dès la fermeture : seule la file continue.

#include <cstdint>
#include <functional>
#include <memory>

namespace tentacle::lifecycle {

inline constexpr int64_t kDrainTickMs = 5'000;
inline constexpr int64_t kDrainIdleGiveUpMs = 10 * 60'000;

/// Ce que le processus fait pendant qu'il finit, injecté pour le test.
struct DrainDeps {
  /// Transferts en cours ou en file (`transfersInFlight`) ; une exception vaut « fini ».
  std::function<int()> pending;
  /// Au moins un transfert tourne en ce moment.
  std::function<bool()> busy;
  std::function<void()> quit;
  std::function<void()> relaunch;
  /// Coupe la lecture : la fenêtre partie, plus rien ne doit sonner.
  std::function<void()> stopPlayback;
  /// Dit, une fois, que l'app finit ses transferts (notification du système).
  std::function<void(int pending)> announce;
  std::function<int64_t()> now;
  /// Minuteur répété ; rend la fonction qui l'arrête.
  std::function<std::function<void()>(int64_t ms, std::function<void()> tick)> every;
};

class BackgroundDrain {
 public:
  explicit BackgroundDrain(DrainDeps deps) : deps_(std::move(deps)) {}
  /// La fenêtre est partie, des transferts restent : le processus continue sans elle.
  void begin();
  bool active() const { return active_; }
  /// Rouvrir pendant la fin des transferts : relance. Rend faux hors de cette phase.
  bool reopen();
  /// Un tour de vérification (le minuteur l'appelle ; exposé pour le test).
  void check();

 private:
  void end(const std::function<void()>& then);
  DrainDeps deps_;
  bool active_ = false;
  bool idle_ = false;
  int64_t idleSince_ = 0;
  std::function<void()> stopTimer_;
};

}  // namespace tentacle::lifecycle
