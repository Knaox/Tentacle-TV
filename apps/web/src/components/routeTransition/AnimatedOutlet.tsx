import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { UNSAFE_LocationContext as LocationContext, useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { RouteExit } from "./RouteExit";
import { shellSectionKey } from "./routeKeys";

/**
 * L'`<Outlet>` de la coquille, avec une sortie : sous la barre, la section
 * quittée s'efface pendant que la suivante entre. La barre, elle, ne bouge pas.
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

  return (
    <AnimatePresence initial={false}>
      <RouteExit key={shellSectionKey(location.pathname)}>
        <LocationContext.Provider value={frozen}>{outlet}</LocationContext.Provider>
      </RouteExit>
    </AnimatePresence>
  );
}
