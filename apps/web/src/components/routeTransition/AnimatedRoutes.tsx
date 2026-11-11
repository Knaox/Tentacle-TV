import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Routes } from "react-router-dom";
import { useMirror } from "../../mirror/useFormFactor";
import { usePageLocation } from "../../pictureInPicture/usePageLocation";
import { PageEntranceContext } from "./PageEntranceContext";
import { ROUTE_EXIT_LAYER, RouteExit } from "./RouteExit";
import { PLAYER_GROUP, routeGroupKey } from "./routeKeys";
import { RouteProgress } from "./RouteProgress";
import { TransitionLevelContext, createTransitionLevel } from "./transitionLevel";

/**
 * `<Routes>` avec une sortie : la coquille quittée pour une fiche, une fiche quittée pour
 * l'accueil restent à l'écran le temps que la suivante soit prête, puis s'effacent par-dessus
 * elle (`RouteExit`, `transitionLevel.ts`).
 *
 * `location` est passée à `<Routes>` : la page sortante garde l'adresse sous
 * laquelle elle a été rendue (ses `useLocation`, ses `useParams`), au lieu de se
 * re-rendre une dernière fois avec celle de la page suivante.
 *
 * Sorties sèches : vers le lecteur — le splash ou la scène du lecteur prennent
 * tout l'écran, rien ne doit traîner dessous —, et sur le miroir, qui a sa
 * propre grammaire de navigation.
 *
 * **Le lecteur n'entre jamais dans la présence.** `AnimatePresence` ne retire
 * une page sortie que quand TOUTES les sorties en cours ont fini : une seule
 * page qui tarde, et le lecteur quitté restait monté — `<video>` en lecture,
 * aucun arrêt dit à Jellyfin (retour de Damien, 2026-10-12). Rendu à côté, il
 * se démonte dès qu'on le quitte, quoi que fassent les pages. La page d'où l'on
 * vient sort, elle, comme avant (sèchement, sous le lecteur). Avec le PiP, la
 * route du lecteur ne rend rien ici (`PlayerStage`) : rien n'y change.
 */
export function AnimatedRoutes({ children }: { children: ReactNode }) {
  // Pas `useLocation` : une lecture lancée pendant le PiP ne quitte pas la page.
  const location = usePageLocation();
  const mirror = useMirror();
  const group = routeGroupKey(location.pathname);
  const onPlayer = group === PLAYER_GROUP;
  const [level] = useState(createTransitionLevel);
  // Le groupe affiché dans la présence au rendu d'avant : une page qui arrive alors qu'un AUTRE
  // groupe y était le remplace. Au sortir du lecteur, rien n'y était : rien n'est à tenir.
  const shown = useRef<string | null>(null);
  const replaces = shown.current !== null && shown.current !== group;

  useLayoutEffect(() => {
    shown.current = onPlayer ? null : group;
    // Vers le lecteur, aucune page n'arrive dans la présence : c'est ici qu'on dit de partir.
    if (onPlayer) level.setArrival({ ready: true, instant: true });
  }, [group, onPlayer, level]);

  return (
    <TransitionLevelContext.Provider value={level}>
      <AnimatePresence initial={false}>
        {!onPlayer && (
          <RouteExit key={group} instant={mirror} replaces={replaces} layer={ROUTE_EXIT_LAYER}>
            {/* Sous une route : `PageTransition` ne joue aucune entrée (celle de la route suffit). */}
            <PageEntranceContext.Provider value>
              <Routes location={location}>{children}</Routes>
            </PageEntranceContext.Provider>
          </RouteExit>
        )}
      </AnimatePresence>
      {onPlayer && <Routes location={location}>{children}</Routes>}
      {/* Une navigation qui attend plus qu'un instant (serveur lent) : la barre fine du haut. */}
      <RouteProgress />
    </TransitionLevelContext.Provider>
  );
}
