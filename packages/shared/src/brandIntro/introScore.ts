/**
 * La PARTITION du « ta-dum » marin de l'ouverture, en données — celle du site
 * (`introSound.js`) :
 *
 *   ta    le poulpe appuie sur lecture : un coup sourd et rond, comme un bloup
 *   dum   l'écran s'allume : le même coup, plus grave et plus long
 *   puis  un accord de ré (add9) qui s'ouvre comme une vague et se referme
 *         pendant la plongée ; une vague de bruit brun roule d'une oreille à
 *         l'autre ; quelques bulles remontent, loin, dans la réverbération.
 *
 * Tout passe sous un passe-bas (rien au-dessus de ~2 kHz hormis l'air des
 * bulles), aucune attaque sèche, une réverbération sombre, un compresseur doux.
 * Le web la joue par Web Audio (`introSynth`) ; le natif lit le FICHIER qu'on
 * en dérive hors ligne (`apps/tv/scripts/render-intro-sound.mjs`).
 */
import { INTRO_TIMING } from "./introTimeline";

export interface ThumpSpec {
  from: number;
  to: number;
  gain: number;
  decay: number;
  sub: number;
  felt: number;
}

export const INTRO_SCORE = {
  master: 0.5,
  /** Secondes : tout s'est tu. */
  length: 4.8,
  compressor: { threshold: -20, knee: 18, ratio: 3, attack: 0.01, release: 0.4 },
  reverb: { seconds: 3.2, predelay: 0.015, wet: 0.85 },
  /** La vague démarre un peu avant le « ta ». */
  waveLead: 0.04,
  ta: { from: 123.47, to: 73.42, gain: 0.28, decay: 0.6, sub: 0, felt: 0.12 } satisfies ThumpSpec,
  dum: { from: 110, to: 73.42, gain: 0.4, decay: 1.4, sub: 0.16, felt: 0.16 } satisfies ThumpSpec,
  /** L'accord : ré2 la2 fa♯3 la3 mi4 la4 — ouvert, chaud, ni triomphant ni triste. [fréquence, niveau] */
  chord: [
    [73.42, 0.045],
    [110.0, 0.045],
    [185.0, 0.038],
    [220.0, 0.034],
    [329.63, 0.024],
    [440.0, 0.011],
  ] as const,
  bubbles: { count: 8, seed: 8 },
  /** Le tirage des bruits (vague, réverbération) : FIXE, le fichier dérivé est reproductible. */
  noiseSeed: 2026,
} as const;

/** L'écart entre « ta » et « dum », calé sur l'image (appui → allumage). */
export const TA_DUM_GAP_S = (INTRO_TIMING.tvOn - INTRO_TIMING.press.at) / 1000;

/**
 * Le fichier dérivé commence par la vague, `waveLead` avant le « ta » : pour
 * que le « ta » tombe sur l'appui, on lance le fichier d'autant plus tôt.
 */
export const INTRO_SOUND_TA_OFFSET_S = INTRO_SCORE.waveLead;

/** Un tirage pseudo-aléatoire FIXE (congruence linéaire, celle du site). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
