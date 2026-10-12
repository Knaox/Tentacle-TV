import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Routes } from "react-router-dom";
import { useMirror } from "../../mirror/useFormFactor";
import { usePageLocation } from "../../pictureInPicture/usePageLocation";
import { RouteExit, type RouteExitCustom } from "./RouteExit";
import { PLAYER_GROUP, routeGroupKey } from "./routeKeys";

/**
 * `<Routes>` avec une sortie : la coquille quittée pour une fiche, une fiche
 * quittée pour l'accueil s'effacent au lieu de disparaître d'un coup.
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
  const instant = mirror || onPlayer;
  const custom: RouteExitCustom = { instant };

  return (
    <>
      <AnimatePresence initial={false} custom={custom}>
        {!onPlayer && (
          <RouteExit key={group} instant={instant}>
            <Routes location={location}>{children}</Routes>
          </RouteExit>
        )}
      </AnimatePresence>
      {onPlayer && <Routes location={location}>{children}</Routes>}
    </>
  );
}
