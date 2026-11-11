import { motion, useReducedMotion } from "framer-motion";
import { useContext, type ReactNode } from "react";
import { pageTransition } from "../theme/motion";
import { PageEntranceContext } from "./routeTransition/PageEntranceContext";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /**
   * Page déjà ouverte par une AUTRE chorégraphie — le calque d'élément partagé
   * de la fiche média, par exemple. Elle rend alors son état final d'emblée.
   *
   * Sans cela, deux entrées se jouent sur le même contenu : celle-ci se déroule
   * SOUS le calque, invisible, et n'a plus qu'à se terminer au mauvais moment.
   * Quand le calque se lève avant la fin, on découvre une page encore à
   * mi-opacité.
   */
  skip?: boolean;
}

/**
 * Le cadre d'une page.
 *
 * **Sous une route, il ne joue rien** (lot « rf2 », nov. 2026). L'entrée d'une page est celle de
 * la route : la page quittée reste à l'écran le temps que celle-ci soit prête, puis s'efface
 * par-dessus elle (`routeTransition/RouteExit`). Un fondu d'entrée à elle, joué en même temps,
 * faisait passer l'écran par le fond de page — deux fondus croisés ne sont pas un fondu
 * enchaîné — et montrait la page pendant qu'elle chargeait encore.
 *
 * Hors d'une route (une vue d'Octave, un écran posé seul), la page entre en FONDU, 140 ms — ni
 * glissement, ni échelle : on change de vue des dizaines de fois par séance.
 */
export function PageTransition({ children, className, skip = false }: PageTransitionProps) {
  const reduced = useReducedMotion();
  const underRoute = useContext(PageEntranceContext);
  if (underRoute) return <div className={className}>{children}</div>;
  return (
    <motion.div
      // `initial={false}` : framer rend directement l'état d'arrivée, sans
      // animation ni frame intermédiaire.
      initial={skip ? false : pageTransition.initial}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : pageTransition.animate.transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
