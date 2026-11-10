#pragma once
// La fenêtre PiP — ouverte PAR LA PAGE (`window.open`), fabriquée ici (`pip/pipWindow.ts` et
// `ipc/pip.ts` d'Electron).
//
// Ce qu'affiche le PiP (ses boutons, sa progression) est rendu par la page dans cette fenêtre,
// par un portail React : même contexte JavaScript, mêmes traductions. La coquille ne fait que
// FABRIQUER la fenêtre : le second navigateur hors écran (`glue/pip_client`), sa fenêtre native
// (`Platform::createWindow`), et la vidéo qu'on y PRÊTE — la même couche de mpv, rangée sous
// la page du PiP par le compositeur (`Compositor::lendVideo`) : ni nouvelle instance, ni
// nouvelle sortie vidéo, ni nouvelle couche. C'est ce qui garde la lecture ET le HDR.
//
// Portable, sans CEF : le navigateur du PiP n'est vu que par `Page`. Fil principal.

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "pip/pip_ports.h"
#include "pip/pip_session.h"
#include "pip/rules/pip_arming.h"

namespace tentacle::pip {

/// Le navigateur du PiP, vu d'ici.
class Page {
 public:
  virtual ~Page() = default;
  /// Fermeture forcée (le document n'a rien à retenir).
  virtual void close() = 0;
  /// La fenêtre a changé de taille ou d'écran : la page relit sa géométrie.
  virtual void geometryChanged() = 0;
};

class Controller {
 public:
  /// `video` : la pile de la fenêtre principale ; `home` : la couche qui y reste toujours (la
  /// couche factice du repos), jamais prêtée.
  Controller(Platform& platform, Compositor* video, VideoSurface* home, Frame frame);
  ~Controller();

  // --- Commandes de la page (`pip_*`) ---------------------------------------------------------
  /// `pip_open` : la page ANNONCE la fenêtre (taille de la VIDÉO) ; rend le cadre à dessiner.
  Frame arm(Mode mode, double width, double height);
  bool setMode(Mode mode, std::optional<Size> video);
  bool resize(double width, double height);
  bool setGesture(std::optional<Gesture> gesture, std::optional<Point> grab);
  /// L'image regagne sa place dans le lecteur ; `done(vrai)` à l'arrivée, `faux` sans PiP.
  void restore(std::function<void(bool)> done);
  /// `pip_close` : la page ferme le PiP par la coquille. Faux sans PiP.
  bool close();

  // --- Le navigateur du PiP (glue CEF) --------------------------------------------------------
  /// Une demande d'ouverture de fenêtre (filtre des popups).
  OpenDecision decide(const std::string& frameName, const std::string& url);
  /// Le navigateur accepté est né : la fenêtre se fabrique, la vidéo y passe, l'entrée commence.
  void popupCreated(std::unique_ptr<Page> page, PageInput input);
  /// Le navigateur du PiP se ferme (fermé par la page, ou par nous) : la vidéo revient.
  void popupClosing();
  /// … puis il est détruit : la fenêtre part avec lui.
  void popupClosed();
  /// La page du PiP change de curseur.
  void setCursor(int cefCursorType);

  // --- La fenêtre principale -----------------------------------------------------------------
  /// Elle se ferme POUR DE BON (la garde de sortie l'a laissée partir) : le PiP part AVANT
  /// elle, et sa fermeture rend la vidéo à une page encore vivante (`pip/pipQuit.ts`).
  void hostClosing();
  /// Un navigateur de PiP vit-il encore (à fermer avant CefShutdown) ?
  bool popupAlive() const { return page_ != nullptr; }

  // --- Géométrie que lit le navigateur du PiP (points) ---------------------------------------
  Size viewSize() const;
  double scale() const;
  Box screenBounds() const;
  Box screenWorkArea() const;
  Point viewToScreen(Point view) const;
  /// La pile de couches de la fenêtre PiP (sa page), ou nullptr avant sa naissance.
  Compositor* compositor() const;
  /// Diagnostic : le cadre de la fenêtre PiP, son mode, la vidéo prêtée.
  std::optional<Box> windowBounds() const;
  Mode mode() const { return mode_; }
  bool videoLent() const { return lent_; }
  Window* window() const { return window_.get(); }

 private:
  void releaseVideo();
  void endSession();
  bool rebuild(std::optional<Size> video);

  Platform& platform_;
  Compositor* video_;
  VideoSurface* home_;
  Frame frame_;
  Arming arming_;
  std::optional<OpenDecision> pending_;  // acceptée, navigateur pas encore né
  std::unique_ptr<Page> page_;
  std::unique_ptr<Window> window_;
  std::unique_ptr<Session> session_;
  PageInput input_;      // gardée : une fenêtre recréée (rebuild) la reprend
  double aspect_ = 0;    // celui de l'ouverture, pour la session d'une fenêtre recréée
  Mode mode_ = Mode::floating;
  bool lent_ = false;
  bool closing_ = false;
};

}  // namespace tentacle::pip
