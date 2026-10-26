/**
 * Octave — l'IMAGE d'une ambiance : sa couleur (assombrie en haut à gauche, là où un nom se pose) et la HOULE
 * d'Octave au pied — deux vagues FIXES, à la phase propre à l'ambiance (deux cartes voisines n'ont pas la même mer),
 * qui glissent d'un pas au survol de leur carte (`moods.css`, transform seul). Rien qui tourne en boucle.
 */

import { memo, useMemo, type ReactNode } from "react";
import { waveBodyPath } from "../motion/wavePath";
import { moodBackground } from "./moodModel";
import "./moods.css";

function phaseOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 60;
}

export const MoodArtwork = memo(function MoodArtwork({ id, color, artworkUrl, className, children }: { id: string; color: string; artworkUrl?: string | null; className: string; children?: ReactNode }) {
  const style = useMemo(() => ({ backgroundImage: moodBackground(color) }), [color]);
  const [back, front] = useMemo(() => {
    const phase = phaseOf(id);
    return [
      waveBodyPath({ period: 60, amplitude: 4, baseline: 88, from: -20, to: 200, phase }, 130),
      waveBodyPath({ period: 44, amplitude: 3, baseline: 100, from: -20, to: 200, phase: phase + 17 }, 130),
    ];
  }, [id]);
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {artworkUrl && <img src={artworkUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
      <svg aria-hidden viewBox="0 0 160 120" preserveAspectRatio="none" className="octave-mood-wave pointer-events-none absolute inset-y-0 -left-2 h-full w-[calc(100%+24px)]">
        <path d={back} fill="#ffffff" fillOpacity={0.1} />
        <path d={front} fill="#ffffff" fillOpacity={0.08} />
      </svg>
      {children}
    </div>
  );
});
