/**
 * Parole ou musique ? — le modèle, et la frise qu'on en tire.
 *
 * Une régression logistique sur les treize mesures de `audioFeatures.ts` et leur
 * contexte (moyenne et écart-type sur ±3 s) : 39 entrées, un poids chacune.
 * Ajustée sur les génériques et les scènes de 44 films relevés à l'œil
 * (`docs/SEGMENTS-LABO-FIN.md`), validée film par film — chaque film laissé hors
 * de l'apprentissage à son tour.
 *
 * ⚠️ Les poids ne valent que pour les mesures exactes de `audioFeatures.ts`.
 *
 * La frise : `S` parole (ou bruitages — tout ce qui n'est pas de la musique),
 * `M` musique, `Q` silence (sous −55 dBFS), `?` indécis. Chaque seconde prend
 * la classe majoritaire de ±4 s autour d'elle : une réplique isolée sur une
 * musique n'est pas une scène, un temps mort dans un dialogue n'est pas un
 * générique.
 */

import { FEATURE_COUNT } from "./audioFeatures";
import { SPEECH_MODEL } from "./speechModelWeights";

export type AudioClass = "S" | "M" | "Q" | "?";

/** Sous ce niveau, une seconde est muette. */
export const SILENCE_DB = -55;
const CONTEXT_SECONDS = 3;
const SMOOTH_SECONDS = 4;

/** Les 39 entrées d'une seconde : mesures brutes, moyennes et écarts-types sur ±3 s. */
export function contextRow(rows: readonly Float64Array[], index: number): Float64Array {
  const from = Math.max(0, index - CONTEXT_SECONDS);
  const to = Math.min(rows.length, index + CONTEXT_SECONDS + 1);
  const n = to - from;
  const out = new Float64Array(FEATURE_COUNT * 3);
  for (let f = 0; f < FEATURE_COUNT; f++) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += rows[i][f];
    const m = sum / n;
    let sq = 0;
    for (let i = from; i < to; i++) sq += (rows[i][f] - m) ** 2;
    out[f] = rows[index][f];
    out[FEATURE_COUNT + f] = m;
    out[2 * FEATURE_COUNT + f] = Math.sqrt(sq / n);
  }
  return out;
}

/** La probabilité « parole » de chaque seconde. */
export function speechProbabilities(rows: readonly Float64Array[]): Float64Array {
  const { mu, sd, w, b } = SPEECH_MODEL;
  const out = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const x = contextRow(rows, i);
    let z = b;
    for (let j = 0; j < x.length; j++) z += ((x[j] - mu[j]) / sd[j]) * w[j];
    out[i] = 1 / (1 + Math.exp(-z));
  }
  return out;
}

/** La frise lissée, un caractère par seconde. */
export function audioClasses(rows: readonly Float64Array[]): string {
  const p = speechProbabilities(rows);
  const raw: AudioClass[] = rows.map((row, i) => (row[0] < SILENCE_DB ? "Q" : p[i] >= 0.5 ? "S" : "M"));
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const from = Math.max(0, i - SMOOTH_SECONDS);
    const to = Math.min(raw.length, i + SMOOTH_SECONDS + 1);
    const counts = { S: 0, M: 0, Q: 0 };
    for (let j = from; j < to; j++) if (raw[j] !== "?") counts[raw[j] as "S" | "M" | "Q"]++;
    const best = (["S", "M", "Q"] as const).reduce((a, c) => (counts[c] > counts[a] ? c : a), "S" as "S" | "M" | "Q");
    out += counts[best] * 2 > to - from ? best : "?";
  }
  return out;
}
