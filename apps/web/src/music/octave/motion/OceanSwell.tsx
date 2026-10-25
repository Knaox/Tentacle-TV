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

// Deux crêtes par boîte de 16 (période 8), dans un calque deux fois plus large : glisser de 50 % (deux
// périodes) boucle. Les deux vagues ne se croisent jamais (avant : 9,5 → 12,5 ; arrière : 4,3 → 6,7).
const FRONT = wavePath({ period: 8, amplitude: 1.5, baseline: 11, from: -4, to: 36 });
const BACK = wavePath({ period: 8, amplitude: 1.2, baseline: 5.5, from: -4, to: 36, phase: 3 });
// La mer calme (pause) : des rides basses, immobiles, dans la boîte seule.
const CALM_FRONT = wavePath({ period: 8, amplitude: 0.5, baseline: 11, from: -4, to: 20 });
const CALM_BACK = wavePath({ period: 8, amplitude: 0.4, baseline: 5.5, from: -4, to: 20, phase: 3 });

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
