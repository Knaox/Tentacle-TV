import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { UNSAFE_LocationContext as LocationContext, useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { PageEntranceContext } from "./PageEntranceContext";
import { RouteExit } from "./RouteExit";
import { shellSectionKey } from "./routeKeys";
import { GlassAmbient } from "../../theme/glass";
import { TransitionLevelContext, createTransitionLevel } from "./transitionLevel";

/**
 * L'`<Outlet>` de la coquille, avec une sortie : sous la barre, la section quittée reste à
 * l'écran le temps que la suivante soit prête, puis s'efface par-dessus elle (`RouteExit`). La
 * barre, elle, ne bouge pas — son onglet courant change tout de suite : le clic a été entendu.
 *
 * La page sortante est rendue avec l'élément et l'adresse qu'elle avait :
 * `AnimatePresence` garde l'élément d'un enfant qui sort, donc ses props — ici
 * l'outlet (ses `useParams`) et l'adresse. Sans cette adresse figée, une page
 * qui lit `useLocation` ou `useSearchParams` se re-rendrait une dernière fois
 * avec celle de la page suivante, et ses effets pourraient y réagir (une
 * recherche qui réécrit l'URL, par exemple). `UNSAFE_LocationContext` est le
 * contexte que `<Routes location>` pose lui-même, exporté par le routeur.
 */
export function AnimatedOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const navigationType = useNavigationType();
  const frozen = useMemo(() => ({ location, navigationType }), [location, navigationType]);
  const [level] = useState(createTransitionLevel);
  const section = shellSectionKey(location.pathname);
  // La section affichée au rendu d'avant : celle qui arrive à sa place la remplace.
  const shown = useRef<string | null>(null);
  const replaces = shown.current !== null && shown.current !== section;
  useLayoutEffect(() => {
    shown.current = section;
  }, [section]);

  return (
    <TransitionLevelContext.Provider value={level}>
      <AnimatePresence initial={false}>
        {/* Sous le verre, la section n'a pas le fond ambiant dans son enveloppe (il est à la
            coquille, `AppLayout`) : sa plaque le reprend. Ailleurs, `GlassAmbient` ne rend rien. */}
        <RouteExit key={section} replaces={replaces} backdrop={<GlassAmbient className="lgc-ambient" />}>
          <LocationContext.Provider value={frozen}>
            {/* Sous une route : `PageTransition` ne joue aucune entrée (celle de la route suffit). */}
            <PageEntranceContext.Provider value>{outlet}</PageEntranceContext.Provider>
          </LocationContext.Provider>
        </RouteExit>
      </AnimatePresence>
    </TransitionLevelContext.Provider>
  );
}
