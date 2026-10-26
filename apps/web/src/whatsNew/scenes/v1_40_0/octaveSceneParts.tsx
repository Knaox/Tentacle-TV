import { waveBodyPath, wavePath } from "../../../music/octave/motion/wavePath";
import "./octaveScene.css";

/**
 * Les pièces de la scène d'Octave : des pochettes FACTICES (dégradés de la
 * marque et une vague, jamais la pochette d'un artiste), la houle « en cours »
 * des rangées et la mer de l'« en cours » plein écran — les mêmes formes que
 * `music/octave/motion/` (géométrie partagée : `wavePath`), animées par la
 * feuille de la scène (`octaveScene.css` : transform seul, par pas, en pause
 * hors scène).
 */

/** L'encre prune d'Octave (`--oc-ink-raised` de `octaveTokens.css`, que l'écran des nouveautés ne charge pas). */
export const OCTAVE_INK = "#0E0B13";

/** Des pochettes inventées : un nom, un dégradé, une vague. */
export const FAUX_ALBUMS = [
  { title: "Nocturne", tone: "linear-gradient(150deg, #3B1D5E 0%, #8B5CF6 55%, #EC4899 100%)" },
  { title: "Lagune", tone: "linear-gradient(160deg, #0F3D4C 0%, #1F7A8C 50%, #F472B6 120%)" },
  { title: "Corail", tone: "linear-gradient(140deg, #4A1030 0%, #DB2777 60%, #FBCFE8 120%)" },
] as const;

/** L'artiste des pochettes factices. */
export const FAUX_ARTIST = "Ensemble du Large";

const COVER_WAVE = wavePath({ period: 40, amplitude: 5, baseline: 70, from: -20, to: 120 });
const COVER_WAVE_2 = wavePath({ period: 28, amplitude: 3, baseline: 80, from: -20, to: 120, phase: 9 });

/** Une pochette factice : le dégradé, deux vagues claires, un rayon doux. */
export function FauxCover({ album, size, radius = 10 }: { album: (typeof FAUX_ALBUMS)[number]; size: number; radius?: number }) {
  return (
    <div className="relative overflow-hidden shadow-[0_10px_26px_-10px_rgba(0,0,0,0.6)]" style={{ width: size, height: size, borderRadius: radius, background: album.tone }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <path d={COVER_WAVE} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinecap="round" />
        <path d={COVER_WAVE_2} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}

const SWELL_FRONT = wavePath({ period: 8, amplitude: 1.5, baseline: 11, from: -4, to: 36 });
const SWELL_BACK = wavePath({ period: 8, amplitude: 1.2, baseline: 5.5, from: -4, to: 36, phase: 3 });

/** La houle « en cours » d'Octave, 16 px, au rose : deux vagues qui roulent en sens contraire. */
export function SceneSwell({ size = 16 }: { size?: number }) {
  return (
    <span className="wn-oc-swell" style={{ width: size, height: size }} aria-hidden>
      {[{ d: SWELL_BACK, cls: "wn-oc-swell-back", w: 1.5 }, { d: SWELL_FRONT, cls: "wn-oc-swell-front", w: 1.8 }].map((wave) => (
        <span key={wave.cls} className={`wn-oc-swell-wave ${wave.cls}`}>
          <svg viewBox="0 0 32 16" preserveAspectRatio="none">
            <path d={wave.d} fill="none" stroke="currentColor" strokeWidth={wave.w} strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </span>
  );
}

const SPAN = { from: -100, to: 1900 };
const BANDS = [
  { name: "back", body: waveBodyPath({ period: 300, amplitude: 16, baseline: 40, ...SPAN }, 200), color: "var(--brand-rgb)", top: 0.16 },
  { name: "mid", body: waveBodyPath({ period: 200, amplitude: 10, baseline: 34, phase: 50, ...SPAN }, 200), color: "31, 122, 140", top: 0.18 },
  { name: "front", body: waveBodyPath({ period: 300, amplitude: 12, baseline: 30, phase: 110, ...SPAN }, 200), color: "var(--brand-accent-rgb)", top: 0.16 },
] as const;

/** La mer de l'« en cours » : trois bandes de houle au pied de la scène, qui dérivent en sens contraires. */
export function SceneOcean({ height }: { height: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height }} aria-hidden>
      {BANDS.map((band, i) => (
        <span key={band.name} className={`wn-oc-band wn-oc-band-${band.name}`} style={{ height: `${100 - i * 18}%` }}>
          <span className="wn-oc-drift">
            <svg viewBox="0 0 1800 200" preserveAspectRatio="none">
              <path d={band.body} style={{ fill: `rgba(${band.color}, ${band.top})` }} />
              {band.name === "front" && <path d={wavePath({ period: 300, amplitude: 12, baseline: 30, phase: 110, ...SPAN })} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />}
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}
