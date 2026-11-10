#pragma once
// Le passage lecteur ↔ PiP (`pip/pipMotion.ts`) : d'où part la fenêtre PiP, où elle arrive,
// et la courbe entre les deux.
//
// La vidéo ne change jamais d'instance : c'est la MÊME couche de mpv, rangée sous la page de
// la fenêtre PiP (compositeur). Animer le cadre du PiP, c'est donc animer l'image elle-même :
// elle part de là où le lecteur la montrait — l'image, pas la zone et ses bandes noires — et
// rejoint son coin. Au retour, l'inverse, puis le lecteur la reprend au même endroit.

#include "pip/rules/pip_frame.h"

namespace tentacle::pip {

/// Réduire : l'image entre dans son coin.
constexpr double kShrinkMs = 280;
/// Agrandir : plus court — on attend le lecteur, pas le geste.
constexpr double kGrowMs = 220;
/// Un cran de molette : la taille y glisse, sans traîner derrière la main.
constexpr double kResizeMs = 120;
/// Un pas d'animation n'avance jamais de plus de deux images à 60 Hz : après un trou du fil
/// principal, l'animation REPREND où elle en était au lieu de sauter.
constexpr double kMaxStepMs = 34;
/// Le curseur suivi pendant un geste, et le pas d'une animation — une image à 60 Hz.
constexpr double kFrameMs = 16;

/// Décélération franche — l'image « se pose » (ease-out cubique).
double easeOutCubic(double t);

/// Le rectangle à l'avancement `t` (0 → 1), au point près.
Box interpolateBox(const Box& from, const Box& to, double t);

/// L'image dans la zone du lecteur, au ratio `aspect` : ce que mpv y montre, bandes noires
/// exclues (centrée, comme `keepaspect`). Un ratio illisible vaut 16:9.
Box pictureIn(const Box& area, double aspect);

/// La fenêtre PiP dont la vidéo occupe exactement `picture` : liseré et ombre autour.
Box windowAround(const Frame& frame, const Box& picture);

}  // namespace tentacle::pip
