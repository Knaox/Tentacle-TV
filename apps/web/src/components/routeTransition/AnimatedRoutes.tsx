import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Routes } from "react-router-dom";
import { useMirror } from "../../mirror/useFormFactor";
import { usePageLocation } from "../../pictureInPicture/usePageLocation";
import { RouteExit, type RouteExitCustom } from "./RouteExit";
import { routeGroupKey } from "./routeKeys";

/**
 * `<Routes>` avec une sortie : la coquille quittée pour une fiche, une fiche
 * quittée pour l'accueil s'effacent au lieu de disparaître d'un coup.
 *
 * `location` est passée à `<Routes>` : la page sortante garde l'adresse sous
 * laquelle elle a été rendue (ses `useLocation`, ses `useParams`), au lieu de se
 * re-rendre une dernière fois avec celle de la page suivante.
 *
 * Sorties sèches : vers le lecteur et depuis lui — le splash ou la scène du
 * lecteur prennent tout l'écran, rien ne doit traîner dessous —, et sur le
 * miroir, qui a sa propre grammaire de navigation.
 */
export function AnimatedRoutes({ children }: { children: ReactNode }) {
  // Pas `useLocation` : une lecture lancée pendant le PiP ne quitte pas la page.
  const location = usePageLocation();
  const mirror = useMirror();
  const group = routeGroupKey(location.pathname);
  const instant = mirror || group === "watch";
  const custom: RouteExitCustom = { instant };

  return (
    <AnimatePresence initial={false} custom={custom}>
      <RouteExit key={group} instant={instant}>
        <Routes location={location}>{children}</Routes>
      </RouteExit>
    </AnimatePresence>
  );
}
