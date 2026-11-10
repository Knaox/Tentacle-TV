#pragma once
// Le redimensionnement NATIF du PiP par les bords du système (macOS, Windows) : ratio
// verrouillé, taille bornée, coin d'ancrage gardé (`pip/pipResizeGuard.ts`).
//
// Une fenêtre redimensionnable reçoit du système le curseur diagonal au survol de ses coins
// sans clic préalable, et se laisse tirer d'emblée : la coquille y ajoute le ratio de l'image
// (cadre en plus), les bornes du PiP, et, ancré, le coin bas-droit collé à l'application.

#include "pip/rules/pip_frame.h"

namespace tentacle::pip {

/// La taille de fenêtre permise la plus proche, au ratio `aspect` de la vidéo.
Size boundedSize(const Frame& frame, double width, double aspect, double maxVideoWidth);

/// Ce que devient une demande du système (`next`, le cadre proposé) : bornée et au ratio ;
/// flottant, le bord que la main ne tire pas reste en place ; ancré, le coin bas-droit de
/// `dockArea`. Rend `next` lui-même quand il convient déjà.
Box guardResize(const Frame& frame, Mode mode, const Box& current, const Box& next,
                double aspect, double maxVideoWidth, const Box& dockArea);

}  // namespace tentacle::pip
