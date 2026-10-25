/**
 * Octave — l'indicateur « en cours » : une petite houle, deux vagues qui
 * roulent en sens contraire (le « ≈ » de l'eau, vivant), jamais les barres
 * d'un égaliseur. Lisible de 12 à 16 px, à la couleur du texte (`currentColor` :
 * l'accent d'Octave là où on le monte).
 *
 * Coût : chaque vague est un calque HTML qui GLISSE (`transform` seul, par pas,
 * `oceanMotion.css`) — son SVG est dessiné une fois, jamais repeint. Hors
 * écran, fenêtre cachée ou sous le lecteur plein écran : suspendue. En pause,
 * la mer se calme (deux rides immobiles, en fondu d'opacité). Mouvement
 * réduit : la houle fixe.
 */

import { memo } from "react";
import { useInViewport } from "../../../hooks/useInViewport";
import { usePagesCovered } from "./oceanCover";
import { swellState } from "./swellState";
import { wavePath } from "./wavePath";
import "./oceanMotion.css";

// Deux périodes de 16 unités dans un calque deux fois plus large que la boîte : glisser de 50 % boucle.
const FRONT = wavePath({ period: 16, amplitude: 2.3, baseline: 10, from: -4, to: 36 });
const BACK = wavePath({ period: 16, amplitude: 1.7, baseline: 5.6, from: -4, to: 36, phase: 5 });
// La mer calme (pause) : des rides basses, immobiles, dans la boîte seule.
const CALM_FRONT = wavePath({ period: 10, amplitude: 0.7, baseline: 10, from: -2, to: 18 });
const CALM_BACK = wavePath({ period: 10, amplitude: 0.5, baseline: 5.6, from: -2, to: 18, phase: 4 });

function Wave({ d, width, className }: { d: string; width: number; className: string }) {
  return (
    <span className={`oc-swell-wave ${className}`}>
      <svg viewBox="0 0 32 16" preserveAspectRatio="none" focusable="false">
        <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export interface OceanSwellProps {
  /** La musique joue-t-elle ? Faux : la mer se calme. */
  playing: boolean;
  /** Taille et couleur (classes) : 16 px par défaut, la couleur du texte. */
  className?: string;
}

export const OceanSwell = memo(function OceanSwell({ playing, className = "h-4 w-4" }: OceanSwellProps) {
  const { ref, visible } = useInViewport<HTMLSpanElement>();
  // Sous le lecteur plein écran (opaque), la houle d'une rangée n'est vue de personne.
  const covered = usePagesCovered();
  return (
    <span ref={ref} aria-hidden className={`oc-swell ${className}`} data-swell={swellState(playing, visible && !covered)}>
      <span className="oc-swell-sea">
        <Wave d={BACK} width={1.5} className="oc-swell-back" />
        <Wave d={FRONT} width={1.8} className="oc-swell-front" />
      </span>
      <span className="oc-swell-calm">
        <svg viewBox="0 0 16 16" focusable="false">
          <path d={CALM_BACK} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
          <path d={CALM_FRONT} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
});
