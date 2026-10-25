/**
 * Octave — l'ambiance marine du lecteur « en cours » plein écran, sobre :
 *
 * - une LUEUR derrière la pochette, à sa teinte (`useArtworkTint`), fixe,
 *   renouvelée en fondu à chaque titre ;
 * - des REFLETS : trois flaques de lumière, en haut, qui jouent lentement
 *   comme la surface vue d'en dessous ;
 * - la HOULE : trois bandes d'eau au pied de la scène (violet au fond, la
 *   teinte de la pochette, le rose devant avec une crête de lumière), qui
 *   dérivent en sens contraires et se soulèvent doucement.
 *
 * Posée sous le contenu, jamais devant (aucun pointeur), opaque à rien :
 * aucun verre, aucun flou, aucun mélange. Elle ne bouge que si la musique
 * joue ET que la fenêtre est visible ; en pause, la mer se fige. Montée, elle
 * suspend les houles des pages qu'elle couvre (`oceanCover.ts`).
 */

import { memo, useId, type CSSProperties } from "react";
import { useInViewport } from "../../../hooks/useInViewport";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { useCoverPages } from "./oceanCover";
import { swellState } from "./swellState";
import { useArtworkTint } from "./useArtworkTint";
import { waveBodyPath, wavePath, type WaveSpec } from "./wavePath";
import "./oceanMotion.css";

// Bandes de 1 800 unités sur 150 % de la scène : la période de chaque tracé divise 600 (un tiers) : la dérive boucle.
const SPAN = { from: -100, to: 1900 };
const BACK: WaveSpec = { period: 300, amplitude: 16, baseline: 40, phase: 0, ...SPAN };
const MID: WaveSpec = { period: 200, amplitude: 10, baseline: 34, phase: 50, ...SPAN };
const FRONT: WaveSpec = { period: 300, amplitude: 12, baseline: 30, phase: 110, ...SPAN };
const BOTTOM = 200;

const BANDS = [
  { name: "back", body: waveBodyPath(BACK, BOTTOM), crest: null },
  { name: "mid", body: waveBodyPath(MID, BOTTOM), crest: null },
  { name: "front", body: waveBodyPath(FRONT, BOTTOM), crest: wavePath(FRONT) },
] as const;

function Band({ name, body, crest, gradientId }: { name: string; body: string; crest: string | null; gradientId: string }) {
  return (
    <span className={`oc-ocean-band oc-ocean-band-${name}`}>
      <span className="oc-ocean-drift">
        <svg viewBox={`0 0 1800 ${BOTTOM}`} preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.15" className={`oc-ocean-stop-${name} oc-ocean-stop-top`} />
              <stop offset="1" className={`oc-ocean-stop-${name} oc-ocean-stop-bottom`} />
            </linearGradient>
          </defs>
          <path d={body} fill={`url(#${gradientId})`} />
          {crest && <path d={crest} fill="none" className="oc-ocean-crest" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />}
        </svg>
      </span>
    </span>
  );
}

export const OceanAmbience = memo(function OceanAmbience({ artworkUrl }: { artworkUrl: string | null }) {
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const tint = useArtworkTint(artworkUrl);
  // Un identifiant de dégradé sans « : » (ceux de React gêneraient `url(#…)`).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useCoverPages();
  const style = tint ? ({ "--ocean-tint-rgb": tint } as CSSProperties) : undefined;
  return (
    <div ref={ref} aria-hidden className="oc-ocean" data-ocean={swellState(playing, visible)} style={style}>
      <span key={tint ?? "accent"} className="oc-ocean-glow" />
      <span className="oc-ocean-light oc-ocean-light-1" />
      <span className="oc-ocean-light oc-ocean-light-2" />
      <span className="oc-ocean-light oc-ocean-light-3" />
      {BANDS.map((band) => (
        <Band key={band.name} name={band.name} body={band.body} crest={band.crest} gradientId={`oc-ocean-${uid}-${band.name}`} />
      ))}
    </div>
  );
});
