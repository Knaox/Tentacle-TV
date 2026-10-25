/**
 * Octave — la géométrie des vagues, PURE : une houle est une suite de
 * demi-périodes en courbes quadratiques lissées (`Q` puis `T`), qui donne des
 * crêtes un peu pointues et des creux ronds, comme une vraie vague. Le tracé
 * se RÉPÈTE exactement toutes les `period` unités : décalé d'une période
 * (`translateX`), il retombe sur lui-même — l'animation boucle sans couture.
 */

export interface WaveSpec {
  /** Longueur d'une crête à la suivante (unités du viewBox). */
  period: number;
  /** Hauteur de la crête au-dessus de la ligne de flottaison. */
  amplitude: number;
  /** La ligne de flottaison (y). */
  baseline: number;
  /** Début et fin du tracé : il déborde de la boîte pour qu'aucun bout ne se voie. */
  from: number;
  to: number;
  /** Décalage de phase, en unités (une crête plus tôt ou plus tard). */
  phase?: number;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Le tracé ouvert de la vague (un trait). */
export function wavePath({ period, amplitude, baseline, from, to, phase = 0 }: WaveSpec): string {
  const half = period / 2;
  // Le départ se cale sur la phase : une crête tombe toujours aux mêmes abscisses, quel que soit `from`.
  const start = phase + Math.floor((from - phase) / period) * period;
  const parts = [`M${round(start)} ${round(baseline)}`, `Q${round(start + half / 2)} ${round(baseline - 2 * amplitude)} ${round(start + half)} ${round(baseline)}`];
  for (let x = start + period; x <= to + half; x += half) parts.push(`T${round(x)} ${round(baseline)}`);
  return parts.join(" ");
}

/** La même vague, remplie jusqu'au fond (`bottom`) : un corps d'eau. */
export function waveBodyPath(spec: WaveSpec, bottom: number): string {
  const line = wavePath(spec);
  const start = line.slice(1, line.indexOf(" "));
  return `${line} V${round(bottom)} H${start} Z`;
}
