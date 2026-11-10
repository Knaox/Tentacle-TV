#pragma once
// Le PiP mené par la coquille (`pip/pipShell.ts` d'Electron, macOS et Windows).
//
// - flottant : coin bas-droit de la zone utile de l'écran de l'application, au-dessus des
//   autres fenêtres, sur tous les bureaux — plein écran compris ;
// - ancré : coin bas-droit de la zone de contenu de l'application ; il la suit, reste devant
//   elle, se réduit avec elle (la plateforme, `Window::applyMode`) ;
// - glisser, tirer un coin : la page annonce le geste (`pip_gesture`) et tient le bouton ; la
//   session suit le curseur le temps du geste — rien entre deux gestes ;
// - entrée, retour, molette : animés, une image à 60 Hz, courbe décélérée.
//
// La taille VOULUE vit ici, en points (`pipBounds.ts`) : seules la page (molette, mode) et la
// main (coin tiré, bords du système) la changent — jamais une relecture de la fenêtre.

#include <functional>

#include "pip/pip_ports.h"
#include "pip/rules/pip_frame.h"

namespace tentacle::pip {

class Session {
 public:
  /// Le PiP naît là où le lecteur montrait l'image : il ne rejoint son coin qu'à `enter`.
  /// `aspect` : celui de la vidéo.
  Session(Window& window, Desktop& desktop, Ticker& ticker, Frame frame, Mode mode,
          double aspect);
  ~Session();
  Session(const Session&) = delete;
  Session& operator=(const Session&) = delete;

  /// Le PiP montré : l'image glisse du lecteur à son coin.
  void enter();
  /// Le retour au lecteur : l'image regagne la place qu'elle y aura ; `done` à l'arrivée.
  void restore(std::function<void()> done);
  /// Vers « flottant », le PiP reste où il est ; vers « ancré », il se range au coin.
  void setMode(Mode mode, std::optional<Size> video = std::nullopt);
  /// Une nouvelle taille de VIDÉO (molette) : le coin le plus proche du bord reste fixe.
  void resize(double videoWidth, double videoHeight);
  /// Le geste que la page commence — ou finit (`nullopt`).
  void setGesture(std::optional<Gesture> gesture, std::optional<Point> grab);

  Mode mode() const { return mode_; }
  Size wantedSize() const { return size_; }
  bool animating() const { return static_cast<bool>(animation_.cancel); }
  bool gesturing() const { return static_cast<bool>(gesture_.cancel); }

 private:
  struct GestureState {
    Gesture kind = Gesture::move;
    Box start;
    Point grab, origin;
    std::function<void()> cancel;
  };
  struct Animation {
    std::function<void()> cancel;
    std::function<void()> done;
  };

  void follow();
  void endGesture();
  void animate(const Box& to, double durationMs, std::function<void()> done = {});
  void stopAnimation();
  void place();
  void set(const Box& box);
  double maxVideoWidth();
  Box cornerArea();
  Box playerArea();
  void hostChanged();

  Window& window_;
  Desktop& desktop_;
  Ticker& ticker_;
  Frame frame_;
  Mode mode_;
  double aspect_;
  Size size_;  // la taille voulue de la FENÊTRE
  Box rest_;   // le coin où le PiP se pose à son entrée
  GestureState gesture_;
  Animation animation_;
};

}  // namespace tentacle::pip
