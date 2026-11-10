#pragma once
// Où poser la fenêtre PiP, et comment elle suit un geste (`pip/pipPlacement.ts`).
//
// Les règles de la colle KWin d'Electron, que sa coquille rejoue sur macOS et Windows : le
// même PiP partout — même coin, même marge, mêmes gestes. Les marges se comptent au cadre
// VISIBLE : l'ombre, elle, peut déborder.

#include "pip/rules/pip_frame.h"

namespace tentacle::pip {

/// Le coin bas-droit de `area`, le cadre visible à la marge du bord.
Box cornerPlacement(const Frame& frame, Size size, const Box& area);

/// Le cadre visible gardé dans `area` — l'ombre peut en déborder.
Box clampVisible(const Frame& frame, const Box& box, const Box& area);

/// Une nouvelle taille (molette, bascule de mode) : le coin le plus proche du bord de `area`
/// reste fixe — le PiP rangé en bas à droite grandit vers le haut et la gauche.
Box resizeInPlace(const Frame& frame, const Box& before, Size size, const Box& area);

/// Glisser : le point saisi (`grab`, dans la fenêtre) reste sous le curseur.
Box dragTo(const Frame& frame, const Box& start, Point grab, Point cursor, const Box& area);

/// Tirer un coin : le coin opposé reste fixe, le ratio de l'image est gardé. La taille suit la
/// projection du déplacement sur la diagonale du PiP (un geste seulement horizontal agit à
/// mi-course). `maxVideoWidth` : la plus grande largeur de VIDÉO permise.
Box stretchFrom(const Frame& frame, const Box& start, Gesture corner, double dx, double dy,
                double maxVideoWidth);

}  // namespace tentacle::pip
