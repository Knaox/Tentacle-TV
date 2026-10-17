import { useRef } from "react";
import { motion } from "framer-motion";

export interface FlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DetailFlightProps {
  /** Rectangle du visuel cliqué. */
  from: FlightRect;
  /** Place finale de l'affiche sur la fiche ; `null` tant qu'elle n'est pas mesurée. */
  to: FlightRect | null;
  /** Rayon du visuel de départ. */
  radius: number;
  imageUrl: string;
  travelS: number;
  /** Le visuel est posé sur sa cible. */
  onLanded: () => void;
}

/** Décélération franche puis arrivée qui se pose, sans le moindre rebond (celle du calque). */
const SETTLE = [0.16, 1, 0.3, 1] as const;
/** Au-delà de cet écart de proportions, une échelle uniforme déformerait l'image : repli en mise en page. */
const ASPECT_TOLERANCE = 0.06;
/** Sortie légèrement retardée : le visuel réel de la fiche est déjà dessous, l'œil s'y pose. */
const EXIT = { opacity: 0, transition: { duration: 0.18, delay: 0.04, ease: "easeOut" } } as const;

/** Pur : la transformation qui ramène la boîte posée sur `to` exactement sur `from` (origine en haut à gauche). */
export function flightFromTransform(from: FlightRect, to: FlightRect): string {
  const scale = from.width / to.width;
  return `translate3d(${from.left - to.left}px, ${from.top - to.top}px, 0) scale(${scale})`;
}

/** Pur : les deux visuels ont-ils les mêmes proportions (affiche → affiche, vignette → vignette) ? */
export function sameAspect(from: FlightRect, to: FlightRect): boolean {
  const a = from.width / from.height;
  const b = to.width / to.height;
  return Math.abs(a - b) / b <= ASPECT_TOLERANCE;
}

/**
 * Le visuel en vol de l'ouverture de la fiche (`DetailOpenOverlay`).
 *
 * En `transform` SEUL (1.31.0) : la boîte est posée sur sa place finale et
 * part de la carte par une translation et une échelle uniforme — `transform`
 * entier, que framer confie au compositeur. Le vol animait avant `top`,
 * `left`, `width` et `height`, sur le fil principal, pendant que la fiche se
 * montait dessous sur ce même fil : toutes les images longues de l'ouverture
 * tombaient pendant le vol (mesuré : jusqu'à 78 ms).
 *
 * La cible est figée à la première mesure : la base de la boîte ne bouge plus
 * en plein vol. Proportions différentes (une vignette 16:9 vers une affiche
 * 2:3) : l'ancien vol en mise en page, seul à recadrer sans déformer.
 */
export function DetailFlight({ from, to, radius, imageUrl, travelS, onLanded }: DetailFlightProps) {
  const lockedTo = useRef<FlightRect | null>(null);
  if (to && !lockedTo.current) lockedTo.current = to;
  const target = lockedTo.current;
  const image = <img src={imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />;

  if (target && sameAspect(from, target)) {
    return (
      <motion.div
        key="fly"
        data-detail-flight
        className="absolute overflow-hidden"
        style={{ ...target, borderRadius: 12, transformOrigin: "0 0", boxShadow: "var(--elev-3)" }}
        initial={{ transform: flightFromTransform(from, target) }}
        animate={{ transform: "translate3d(0px, 0px, 0) scale(1)" }}
        exit={EXIT}
        transition={{ duration: travelS, ease: SETTLE }}
        onAnimationComplete={onLanded}
      >
        {image}
      </motion.div>
    );
  }

  // Tant que la fiche n'a pas rendu son visuel, l'image reste à sa place de
  // départ : mieux vaut attendre que partir vers une cible devinée.
  const end = target ?? from;
  return (
    <motion.div
      key="layout"
      data-detail-flight
      className="absolute overflow-hidden"
      initial={{ ...from, borderRadius: radius }}
      animate={{ ...end, borderRadius: 12 }}
      exit={EXIT}
      transition={{ duration: travelS, ease: SETTLE }}
      onAnimationComplete={() => { if (target) onLanded(); }}
      style={{ boxShadow: "var(--elev-3)" }}
    >
      {image}
    </motion.div>
  );
}
