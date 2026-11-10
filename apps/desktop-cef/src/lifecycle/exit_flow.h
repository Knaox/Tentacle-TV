#pragma once
// Le déroulé de la fermeture et de la sortie, sur l'unique fenêtre — la chaîne d'Electron
// (`index.ts`) : `close` (garde de sortie, séquence de fermeture) → `closed` (la musique
// s'arrête) → `window-all-closed` (finir les transferts sans fenêtre, sinon quitter) →
// `will-quit` (l'adieu à Jellyfin, puis le nettoyage).
//
// - Fermer (croix, Alt+F4, bouton rouge) et quitter (Cmd+Q, menu, mise à jour) passent par la
//   même garde ; seule différence : fermer laisse finir les transferts si le réglage le veut,
//   quitter pose la question (`backgroundTransfers.ts` : `quitRequested`).
// - Fermer la fenêtre ferme l'app — sur macOS AUSSI (Electron : une app qu'on croit fermée
//   mais qui garde la barre de menus, et dont la réouverture hérite de l'état d'une session
//   morte). Seule exception : les transferts qui finissent sans elle.
// - Relancer (`window.tentacle.relaunch`, `app.relaunch(); app.exit(0)`) : ni question ni adieu.
//
// Pur : la fenêtre, le navigateur, le lecteur, la boîte et les minuteurs sont des ports.

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>

#include "lifecycle/background_drain.h"
#include "lifecycle/close_sequence.h"
#include "lifecycle/quit_guard.h"

namespace tentacle::lifecycle {

struct ExitPorts {
  // La fenêtre et la page.
  std::function<void()> hideWindow;
  std::function<void()> closeBrowser;  // la page part ; `browserClosed()` suivra
  std::function<void()> focusWindow;   // rouvrir pendant que la fenêtre vit
  // Le lecteur vidéo.
  std::function<bool()> videoRunning;
  std::function<void(std::function<void()> done)> stopVideo;
  std::function<void()> pauseVideo;  // silence pendant l'adieu (écriture asynchrone)
  // Les transferts (hub) et la question native.
  std::function<int()> inFlight;
  std::function<bool()> busy;
  std::function<bool()> backgroundEnabled;
  ExitRequest ask;
  std::function<void(int pending)> announce;  // la notification du système
  // La fin.
  std::function<void()> windowClosed;                          // `closed` : la musique s'arrête
  std::function<void(std::function<void()> done)> farewell;  // adieu à Jellyfin, borné
  std::function<void()> spawnSuccessor;                        // `app.relaunch`
  std::function<void()> finish;                                // la boucle sort, nettoyage
  // Le temps.
  std::function<int64_t()> now;
  std::function<void(int64_t ms, std::function<void()> fn)> after;  // 0 = au prochain tour
  std::function<std::function<void()>(int64_t ms, std::function<void()> tick)> every;
};

class ExitFlow {
 public:
  enum class Phase { Running, Closing, Draining, Quitting, Done };

  explicit ExitFlow(ExitPorts ports);

  /// La croix, Alt+F4, le bouton rouge.
  void requestClose() { request(false); }
  /// Cmd+Q, le menu « Quitter », une mise à jour qui redémarre.
  void requestQuit();
  /// `window.tentacle.relaunch()` : une nouvelle instance, et on part sans rien demander.
  void requestRelaunch();
  /// Dock, seconde instance, lien reçu sans fenêtre : pendant les transferts sans fenêtre, on
  /// RELANCE ; fenêtre ouverte, on la ramène devant. Faux si rien n'a été fait.
  bool reopen();
  /// Le navigateur est détruit (`OnBeforeClose`).
  void browserClosed();

  Phase phase() const { return phase_; }

 private:
  void request(bool quit);
  void proceed();
  void startQuit();
  bool keepsTransfers() const;

  ExitPorts p_;
  Phase phase_ = Phase::Running;
  bool quitRequested_ = false;  // la demande en cours est « quitter », pas « fermer »
  bool quitConfirmed_ = false;  // « Quitter quand même » a été répondu
  bool relaunching_ = false;
  std::unique_ptr<QuitGuard> guard_;
  std::unique_ptr<CloseSequence> sequence_;
  std::unique_ptr<BackgroundDrain> drain_;
};

}  // namespace tentacle::lifecycle
