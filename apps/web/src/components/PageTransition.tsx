import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition } from "../theme/motion";

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
 * L'entrée d'une page : un FONDU seul, 140 ms (refonte de nov. 2026). Plus de glissement ni
 * d'échelle — on change de page des dizaines de fois par séance, et un contenu qui monte à
 * chaque fois fait attendre au lieu d'accompagner. La sortie est jouée par `RouteExit`.
 */
export function PageTransition({ children, className, skip = false }: PageTransitionProps) {
  const reduced = useReducedMotion();
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
