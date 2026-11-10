#pragma once
// Le cadre du PiP : ce qui entoure la vidéo dans la fenêtre PiP (`pip/pipFrame.ts`).
//
// La fenêtre PiP déborde de la vidéo, de chaque côté :
//  - d'un LISERÉ opaque (`bezel`), que la page dessine et qui recouvre les coins carrés de la
//    vidéo pour en dessiner des arrondis (au moins 0,293 × le rayon extérieur, 1 − 1/√2) ;
//  - d'une marge TRANSPARENTE (`shadow`), où la page pose l'ombre du cadre.
// La coquille place la vidéo à `inset` du bord de la fenêtre ; la page reçoit ces valeurs par
// `pip_open` et y dessine son cadre — une seule source.
//
// macOS : marge de 4 (le système redimensionne par ~8 points au coin, ~4 au bord) ;
// Linux : 14 (la colle KWin, l'ombre large) ; Windows : rien (fenêtre opaque, cadre du système).

#include "pip/rules/pip_types.h"

namespace tentacle::pip {

Frame frameFor(Os os);
inline Frame currentFrame() { return frameFor(currentOs()); }

/// En deçà, les boutons du PiP ne tiennent plus — taille de la VIDÉO.
constexpr double kMinVideoWidth = 256;
constexpr double kMinVideoHeight = 144;

/// La plus grande largeur de vidéo, en part de l'écran (flottant) ou de la zone client de
/// l'application (ancré) — les bornes de la page (`pipGeometry.ts`).
constexpr double kMaxShareFloating = 0.6;
constexpr double kMaxShareDocked = 0.45;
inline double maxShare(Mode mode) { return mode == Mode::docked ? kMaxShareDocked : kMaxShareFloating; }

/// La marge du PiP au bord de l'écran (flottant) ou de l'application (ancré), mesurée au cadre
/// VISIBLE (ombre exclue) : celle du PiP natif de KDE (`pipCaptions.ts`, `PIP_MARGIN`).
constexpr double kMargin = 20;

/// La taille de la fenêtre PiP pour une vidéo de cette taille (bornée par le minimum).
Size windowSize(const Frame& frame, double videoWidth, double videoHeight);

}  // namespace tentacle::pip
