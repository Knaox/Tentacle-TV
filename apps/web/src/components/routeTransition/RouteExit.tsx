import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion, useIsPresent, useReducedMotion, type Variants } from "framer-motion";
import { pageTransition } from "../../theme/motion";

/** Transmis par `AnimatePresence custom` : la sortie en cours doit-elle être sèche ? */
export interface RouteExitCustom {
  instant: boolean;
}

const INSTANT_EXIT = { opacity: 0, transition: { duration: 0 } };

// Constantes de module : une identité de `variants` neuve à chaque rendu fait
// ré-résoudre tout l'arbre (cf. `textCascade` dans theme/motion.ts).
const FADE_VARIANTS: Variants = {
  visible: { opacity: 1 },
  exit: (custom?: RouteExitCustom) => (custom?.instant ? INSTANT_EXIT : pageTransition.exit),
};
const INSTANT_VARIANTS: Variants = { visible: { opacity: 1 }, exit: INSTANT_EXIT };

/** Propriétés posées le temps de la sortie, retirées si la page revient. */
const PINNED = ["position", "top", "left", "width", "pointer-events"] as const;

interface RouteExitProps {
  children: ReactNode;
  /** Sortie sèche, quelle que soit la destination (le lecteur, le miroir). */
  instant?: boolean;
}

/**
 * Enveloppe d'une page sous `AnimatePresence` : à sa sortie, la page reste où
 * on la voyait et s'efface pendant que la suivante joue son entrée
 * (`PageTransition`). Seule l'opacité s'anime (règles GPU du CLAUDE.md).
 *
 * **La page sortante est épinglée.** Dès qu'elle n'est plus présente, elle
 * passe en `position: fixed` à l'endroit exact où elle s'affichait : la page
 * suivante prend sa place dans le flux, et la remise en haut du défilement
 * (`useScrollMemory`, un effet passif, donc APRÈS cet effet de mise en page)
 * ne la fait pas sauter. Sans cela, on verrait le haut de la page quittée
 * remonter sous le fondu.
 *
 * `flow-root` : la marge négative des bannières (`-mt-[68px]`, qui glissent
 * sous la barre) reste DANS l'enveloppe. Laissée fuir à travers, elle cesserait
 * de le faire une fois l'enveloppe épinglée — un bloc fixe ne fusionne pas ses
 * marges — et la page sauterait de 68 px.
 */
export function RouteExit({ children, instant = false }: RouteExitProps) {
  const isPresent = useIsPresent();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPresent) {
      // Revenue avant la fin de sa sortie (aller-retour rapide) : au flux.
      PINNED.forEach((property) => el.style.removeProperty(property));
      return;
    }
    const { top, left, width } = el.getBoundingClientRect();
    el.style.setProperty("position", "fixed");
    el.style.setProperty("top", `${top}px`);
    el.style.setProperty("left", `${left}px`);
    el.style.setProperty("width", `${width}px`);
    el.style.setProperty("pointer-events", "none");
  }, [isPresent]);

  return (
    <motion.div
      ref={ref}
      className="flow-root"
      variants={instant || reduced ? INSTANT_VARIANTS : FADE_VARIANTS}
      initial={false}
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
