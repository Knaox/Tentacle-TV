import { motion, useReducedMotion } from "framer-motion";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { duration, pageTransition } from "../theme/motion";
import { PageEntranceContext } from "./routeTransition/PageEntranceContext";
import { hasPageEntered, markPageEntered } from "./routeTransition/pageEntranceMemory";

/** Le fondu d'entrée, et une image de marge : passé ce délai, la page a été VUE. */
const ENTERED_AFTER_MS = duration.page * 1000 + 20;

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
 *
 * Une page DÉJÀ ENTRÉE pendant la session ne rejoue pas son entrée quand on y revient
 * (`pageEntranceMemory`) : au retour d'une fiche, l'accueil est là d'emblée, avec ses affiches
 * — il n'est plus rejoué en fondu sous des images déjà vues. Elle n'est retenue qu'une fois
 * son entrée allée au bout : une page quittée à mi-fondu entrera encore.
 */
export function PageTransition({ children, className, skip = false }: PageTransitionProps) {
  const reduced = useReducedMotion();
  // L'identité de la page (son adresse, figée pour une page qui sort), lue au montage
  // seulement ; absente hors des enveloppes de route (tests) : rien n'est retenu.
  const routeId = useContext(PageEntranceContext);
  const [entranceId] = useState(routeId);
  const [seen] = useState(() => hasPageEntered(entranceId));
  // Retenue une fois le fondu allé au bout — par une minuterie, pas par la fin de l'animation :
  // la toute première page de l'application n'en joue aucune (`AnimatePresence initial={false}`),
  // et doit être retenue quand même.
  useEffect(() => {
    const timer = setTimeout(() => markPageEntered(entranceId), ENTERED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [entranceId]);
  return (
    <motion.div
      // `initial={false}` : framer rend directement l'état d'arrivée, sans
      // animation ni frame intermédiaire.
      initial={skip || seen ? false : pageTransition.initial}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : pageTransition.animate.transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
