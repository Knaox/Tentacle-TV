/**
 * Le CONTRÔLE de la transition douce, dans le lecteur (mobile, web, bureau) et dans les Réglages d'Octave : une
 * seule réglette, « coupée » à gauche puis 2 → 12 s, et le DESSIN du fondu qui en suit la valeur — le titre qui
 * part s'efface pendant que le suivant arrive, à puissance constante (`fadeOutGain` / `fadeInGain`), la largeur
 * du chevauchement à la mesure de la durée. Coupée : un passage net, sans chevauchement. Pur : chaque client
 * dessine ces chemins (SVG sur le web, react-native-svg sur le mobile).
 */

import { CROSSFADE_MAX_S, CROSSFADE_MIN_S, fadeInGain, fadeOutGain, sanitizeCrossfadeMs } from "./crossfadeRules";

/** Les crans de la réglette, en secondes : 0 (coupée), puis chaque seconde de 2 à 12. */
export const CROSSFADE_STOPS_S: readonly number[] = [0, ...Array.from({ length: CROSSFADE_MAX_S - CROSSFADE_MIN_S + 1 }, (_, i) => CROSSFADE_MIN_S + i)];

const LAST = CROSSFADE_STOPS_S.length - 1;

/** Le cran d'une durée (ms) : sa place sur la réglette, de 0 à `CROSSFADE_STOPS_S.length - 1`. */
export function crossfadeStopIndex(ms: number): number {
  const seconds = sanitizeCrossfadeMs(ms) / 1_000;
  const index = CROSSFADE_STOPS_S.indexOf(seconds);
  return index < 0 ? 0 : index;
}

/** La position (0 → 1) d'une durée sur la réglette. */
export function crossfadePosition(ms: number): number {
  return crossfadeStopIndex(ms) / LAST;
}

/** La durée (ms) au point `x` (0 → 1) de la réglette, calée sur le cran le plus proche. */
export function crossfadeAtPosition(x: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
  return (CROSSFADE_STOPS_S[Math.round(clamped * LAST)] ?? 0) * 1_000;
}

/** Un cran de plus ou de moins (accessibilité : « augmenter », « diminuer »). */
export function crossfadeStep(ms: number, delta: 1 | -1): number {
  const index = Math.min(LAST, Math.max(0, crossfadeStopIndex(ms) + delta));
  return (CROSSFADE_STOPS_S[index] ?? 0) * 1_000;
}

export interface CrossfadeShape {
  /** Le titre qui part : son volume, de plein à rien. */
  outgoing: string;
  /** Le titre qui arrive : de rien à plein. */
  incoming: string;
  /** La largeur du chevauchement, en fraction de la largeur dessinée (0 : passage net). */
  overlap: number;
}

/** La part de la largeur que prend le plus long fondu (12 s) : le reste montre les deux titres pleins. */
const MAX_OVERLAP = 0.62;
const SAMPLES = 24;

/**
 * Les deux courbes du fondu dans un cadre `width` × `height` (origine en haut à gauche, plein volume en haut) :
 * chemins SVG « M … L … » fermés vers le bas (aires remplissables). Coupée : deux marches qui se touchent au milieu.
 */
export function crossfadeShape(ms: number, width: number, height: number): CrossfadeShape {
  const seconds = sanitizeCrossfadeMs(ms) / 1_000;
  const overlap = seconds === 0 ? 0 : (seconds / CROSSFADE_MAX_S) * MAX_OVERLAP;
  const start = (width * (1 - overlap)) / 2;
  const end = start + width * overlap;
  const y = (gain: number) => round(height * (1 - gain));
  const outgoing: string[] = [`M0 ${round(height)}`, `L0 ${y(1)}`, `L${round(start)} ${y(1)}`];
  const incoming: string[] = [`M${round(start)} ${round(height)}`];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = i / SAMPLES;
    const at = round(start + (end - start) * x);
    outgoing.push(`L${at} ${y(overlap === 0 ? (i === SAMPLES ? 0 : 1) : fadeOutGain(x))}`);
    incoming.push(`L${at} ${y(overlap === 0 ? (i === 0 ? 0 : 1) : fadeInGain(x))}`);
  }
  outgoing.push(`L${round(end)} ${round(height)}`, "Z");
  incoming.push(`L${round(width)} ${y(1)}`, `L${round(width)} ${round(height)}`, "Z");
  return { outgoing: outgoing.join(" "), incoming: incoming.join(" "), overlap };
}

const round = (value: number): number => Math.round(value * 10) / 10;
