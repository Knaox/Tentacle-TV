import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { easeOut } from "../theme/motion";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /**
   * Page déjà ouverte par une AUTRE chorégraphie — le calque d'élément partagé
   * de la fiche média, par exemple. Elle rend alors son état final d'emblée.
   *
   * Sans cela, deux entrées se jouent sur le même contenu : celle-ci se déroule
   * SOUS le calque, invisible, et n'a plus qu'à se terminer au mauvais moment.
   * Quand le calque se lève avant la fin, on découvre une page encore en train
   * de monter — décalée de 12 px, à 99,5 % d'échelle et à mi-opacité.
   */
  skip?: boolean;
}

export function PageTransition({ children, className, skip = false }: PageTransitionProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      // `initial={false}` : framer rend directement l'état d'arrivée, sans
      // animation ni frame intermédiaire.
      initial={skip ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
