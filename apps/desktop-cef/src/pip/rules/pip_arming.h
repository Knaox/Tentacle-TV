#pragma once
// La fenêtre PiP n'est ouverte que si la page l'a ANNONCÉE juste avant — et une seule fois
// (`pip/pipWindow.ts`, `armPip` / `pipWindowOpen`).
//
// Le filtre des popups est le seul endroit où une page peut faire naître une fenêtre. Une
// seule exception à son refus : une fenêtre nommée `kFrameName`, sur `about:blank`, dans les
// secondes qui suivent la commande `pip_open` — que seule notre page peut envoyer (le pont ne
// sert que le cadre principal de l'origine de l'app). Un document de greffon (autre origine,
// même navigateur) ne peut donc pas ouvrir une fenêtre que la coquille prendrait pour le PiP.

#include <string>

#include "pip/rules/pip_frame.h"

namespace tentacle::pip {

/// Le nom de cadre que la page donne à `window.open` — et qu'elle seule connaît.
inline constexpr const char* kFrameName = "tentacle-pip";
/// Le délai dans lequel la page doit ouvrir la fenêtre annoncée.
constexpr double kArmDelayMs = 3000;

struct Armed {
  Mode mode = Mode::floating;
  double width = 0, height = 0;  // la taille de la VIDÉO
  double untilMs = 0;
};

/// Ce que devient une demande d'ouverture de fenêtre.
struct OpenDecision {
  enum class Kind { notPip, deny, allow } kind = Kind::notPip;
  Mode mode = Mode::floating;
  double videoWidth = 0, videoHeight = 0;
  Size window;  // vidéo + cadre
  double aspect = 16.0 / 9.0;
};

class Arming {
 public:
  /// La page annonce l'ouverture (taille de la VIDÉO) : la prochaine fenêtre PiP sera acceptée.
  void arm(Mode mode, double width, double height, double nowMs);
  /// La demande d'ouverture : `notPip` quand elle ne concerne pas le PiP (le filtre ordinaire
  /// s'applique alors). L'annonce est consommée par toute demande nommée `kFrameName`.
  OpenDecision decide(const std::string& frameName, const std::string& url, double nowMs,
                      bool pipAlreadyOpen, const Frame& frame);
  void reset() { armed_.reset(); }
  bool armed() const { return armed_.has_value(); }

 private:
  std::optional<Armed> armed_;
};

/// Le titre de naissance : sous Linux, quand la colle mène le PiP, il demande aussi l'entrée
/// animée ; ailleurs (ou sans animation), le titre nu du mode.
std::string birthCaption(Mode mode, bool shellDrivesPip, bool reducedMotion);

}  // namespace tentacle::pip
