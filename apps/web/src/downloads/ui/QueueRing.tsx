/**
 * L'anneau du bouton de la barre du haut : l'avancement du LOT, autour de l'icône.
 *
 * `transform` SEULEMENT — pas de `stroke-dashoffset`, qui repeint. Deux moitiés fixes (droite,
 * gauche) servent de fenêtres ; dans chacune, un demi-disque TOURNE et découvre l'arc, et la
 * peinture (le dégradé de jauge, immobile à l'écran) tourne en sens inverse dedans. Deux
 * rotations par moitié, que le compositeur joue seul ; les `clip-path` ne changent jamais.
 *
 *   droite [0°, 180°)   : demi-disque GAUCHE tourné de a1 = min(θ, 180)  → arc [0, a1)
 *   gauche [180°, 360°) : demi-disque DROIT tourné de a2 = max(θ − 180, 0) → arc [180, 180 + a2)
 *
 * Aucune animation infinie : rien ne bat quand rien n'avance.
 */

import type { CSSProperties } from "react";

/** Épaisseur du trait, en px. */
const STROKE = 2.5;

const RING_MASK = `radial-gradient(farthest-side, transparent calc(100% - ${STROKE}px), #000 calc(100% - ${STROKE}px))`;
const PAINT: CSSProperties = { background: "var(--gauge-gradient)", WebkitMaskImage: RING_MASK, maskImage: RING_MASK };
const TRACK: CSSProperties = { background: "var(--gauge-track)", WebkitMaskImage: RING_MASK, maskImage: RING_MASK };

const LAYER = "absolute inset-0";
const TURN = `${LAYER} [transition:transform_var(--duration-card)_linear]`;
const RIGHT_HALF = "[clip-path:inset(0_0_0_50%)]";
const LEFT_HALF = "[clip-path:inset(0_50%_0_0)]";

/** Les deux angles (degrés) d'un avancement entre 0 et 1. */
export function ringAngles(ratio: number): { right: number; left: number } {
  const theta = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 360;
  return { right: Math.min(theta, 180), left: Math.max(theta - 180, 0) };
}

export function QueueRing({ ratio, className = "inset-[3px]" }: { ratio: number; className?: string }) {
  const { right, left } = ringAngles(ratio);
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`} data-ring-right={Math.round(right)} data-ring-left={Math.round(left)}>
      <span className={`${LAYER} rounded-full`} style={TRACK} />
      <span className={`${LAYER} ${RIGHT_HALF}`}>
        <span className={`${TURN} ${LEFT_HALF}`} style={{ transform: `rotate(${right}deg)` }}>
          <span className={`${TURN} rounded-full`} style={{ ...PAINT, transform: `rotate(${-right}deg)` }} />
        </span>
      </span>
      <span className={`${LAYER} ${LEFT_HALF}`}>
        <span className={`${TURN} ${RIGHT_HALF}`} style={{ transform: `rotate(${left}deg)` }}>
          <span className={`${TURN} rounded-full`} style={{ ...PAINT, transform: `rotate(${-left}deg)` }} />
        </span>
      </span>
    </span>
  );
}
