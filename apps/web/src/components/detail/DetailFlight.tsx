import { motion } from "framer-motion";
import { duration, easeOut } from "../../theme/motion";

export interface FlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DetailFlightProps {
  /** Rectangle du visuel cliqué. */
  from: FlightRect;
  /** Place de l'affiche sur la fiche. */
  to: FlightRect;
  /** Rayon du visuel de départ. */
  radius: number;
  imageUrl: string;
  travelS: number;
  /** Le visuel est posé sur sa cible. */
  onLanded: () => void;
}

/** Le rayon de l'affiche de la fiche (`rounded-tile`) : celui où le vol se pose. */
const LANDED_RADIUS = 16;
/** Au-delà de cet écart de proportions, une échelle uniforme déformerait l'image : repli en mise en page. */
const ASPECT_TOLERANCE = 0.06;
const REST = "translate3d(0px, 0px, 0) scale(1)";
/** Posé, le visuel s'efface sur l'affiche de la fiche, à sa place exacte : seule la netteté change. */
const LIFT = { opacity: 0, transition: { duration: duration.pageOut, ease: easeOut } } as const;

/** Pur : la transformation qui amène la boîte posée sur `from` exactement sur `to` (origine en haut à gauche). */
export function flightToTransform(from: FlightRect, to: FlightRect): string {
  const scale = to.width / from.width;
  return `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0) scale(${scale})`;
}

/** Pur : les deux visuels ont-ils les mêmes proportions (affiche → affiche, vignette → vignette) ? */
export function sameAspect(from: FlightRect, to: FlightRect): boolean {
  const a = from.width / from.height;
  const b = to.width / to.height;
  return Math.abs(a - b) / b <= ASPECT_TOLERANCE;
}

/**
 * Le visuel en vol de l'ouverture de la fiche (`DetailOpenOverlay`) : monté À L'INSTANT du
 * départ, sur la carte, il vole jusqu'à la place de l'affiche.
 *
 * En `transform` SEUL : une translation et une échelle uniforme — `transform` entier, que framer
 * confie au compositeur. La fiche se montre sur le fil principal pendant ce vol : animé en
 * `top` / `left` / `width` / `height`, il perdait ses images à ce moment-là (mesuré : jusqu'à
 * 78 ms). L'ombre monte avec lui, en opacité sur son propre calque — une ombre ne s'anime pas.
 *
 * Proportions différentes (la bannière 16:9 vers une affiche 2:3) : le vol en mise en page,
 * seul à recadrer sans déformer.
 */
export function DetailFlight({ from, to, radius, imageUrl, travelS, onLanded }: DetailFlightProps) {
  // `decoding="sync"` : l'image (celle de la carte, déjà en mémoire) est décodée AVANT la peinture
  // qui monte le visuel. Décodée après, elle laissait une image de trou à la place de la carte,
  // que la même image vient de cacher (banc `bench:page-flicker`, CEF à 120 Hz : une image).
  const image = <img src={imageUrl} alt="" draggable={false} decoding="sync" className="h-full w-full object-cover" />;
  const transition = { duration: travelS, ease: easeOut };

  if (!sameAspect(from, to)) {
    return (
      <motion.div
        data-detail-flight
        className="absolute overflow-hidden"
        initial={{ ...from, borderRadius: radius }}
        animate={{ ...to, borderRadius: LANDED_RADIUS }}
        exit={LIFT}
        transition={transition}
        onAnimationComplete={onLanded}
        style={{ boxShadow: "var(--elev-3)" }}
      >
        {image}
      </motion.div>
    );
  }

  return (
    <motion.div
      data-detail-flight
      className="absolute"
      style={{ ...from, transformOrigin: "0 0" }}
      initial={{ transform: REST }}
      animate={{ transform: flightToTransform(from, to) }}
      exit={LIFT}
      transition={transition}
      onAnimationComplete={onLanded}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ borderRadius: radius, boxShadow: "var(--elev-3)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transition}
      />
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: radius }}>
        {image}
      </div>
    </motion.div>
  );
}
