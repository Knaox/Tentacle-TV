/**
 * Octave — le DESSIN de la transition douce (bureau, web) : le titre qui part (violet) s'efface pendant que le
 * suivant (rose) arrive ; la largeur du chevauchement suit la durée. Les chemins du partagé (`crossfadeShape`),
 * les mêmes que sur le mobile. Décoratif : la valeur se dit en mots à côté.
 */

import { memo, useId, useMemo } from "react";
import { crossfadeShape } from "@tentacle-tv/shared/octave";

const WIDTH = 240;
const HEIGHT = 56;

export const CrossfadeGraph = memo(function CrossfadeGraph({ ms }: { ms: number }) {
  const id = useId();
  const shape = useMemo(() => crossfadeShape(ms, WIDTH, HEIGHT), [ms]);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-14 w-full" preserveAspectRatio="none" aria-hidden data-crossfade-graph>
      <defs>
        <linearGradient id={`${id}-out`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`${id}-in`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-accent-light)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--brand-accent)" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path d={shape.outgoing} fill={`url(#${id}-out)`} />
      <path d={shape.incoming} fill={`url(#${id}-in)`} />
    </svg>
  );
});
