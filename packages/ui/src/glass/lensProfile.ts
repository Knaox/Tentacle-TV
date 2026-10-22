/**
 * Le profil PHYSIQUE de la lentille : de combien l'image se déplace à une
 * profondeur donnée du biseau, d'après la loi de Snell.
 *
 * Le modèle, celui du Liquid Glass d'Apple : une dalle de verre posée sur le
 * contenu, plate au centre, dont le bord est un biseau CONVEXE en « squircle »
 * (h(t) = (1 − (1 − t)⁴)^¼, t de 0 au bord à 1 au bout du biseau). Un rayon qui
 * descend verticalement entre dans le verre par une surface inclinée d'un angle
 * θ (la pente du biseau), se plie (sin θ = n · sin θᵣ, n = 1,5), traverse
 * l'épaisseur h et touche le contenu décalé de h · tan(θ − θᵣ).
 *
 * Ce que ça donne, et c'est la signature visuelle : rien au centre (pente
 * nulle), presque rien au ras du bord (épaisseur nulle), et un anneau de forte
 * déviation JUSTE à l'intérieur — le contenu y est grossi et courbé, comme sous
 * une goutte d'eau épaisse. Le décalage pointe vers l'intérieur : on voit, au
 * bord, ce qui est un peu plus au centre.
 *
 * Pur, sans DOM : la courbe est échantillonnée une fois puis interpolée.
 */

/** Indice de réfraction du verre (verre ordinaire). */
export const GLASS_INDEX = 1.5;

const SAMPLES = 256;

/** Hauteur du biseau à la profondeur t (0 au bord, 1 au bout). */
export function bezelHeight(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const u = 1 - t;
  return Math.pow(1 - u * u * u * u, 0.25);
}

/** Pente du biseau (dh/dt), infinie au ras du bord. */
function bezelSlope(t: number): number {
  const u = 1 - t;
  const base = 1 - u * u * u * u;
  if (base <= 0) return Number.POSITIVE_INFINITY;
  return (u * u * u) / Math.pow(base, 0.75);
}

/** Décalage brut (en épaisseurs de verre) à la profondeur t. */
function rawShift(t: number, index: number): number {
  if (t <= 0 || t >= 1) return 0;
  const theta = Math.atan(bezelSlope(t));
  const refracted = Math.asin(Math.sin(theta) / index);
  return bezelHeight(t) * Math.tan(theta - refracted);
}

interface Table {
  index: number;
  values: Float64Array;
}

let table: Table | null = null;

function tableFor(index: number): Float64Array {
  if (table !== null && table.index === index) return table.values;
  const values = new Float64Array(SAMPLES + 1);
  let peak = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    values[i] = rawShift(i / SAMPLES, index);
    peak = Math.max(peak, values[i]);
  }
  for (let i = 0; i <= SAMPLES; i++) values[i] = peak > 0 ? values[i] / peak : 0;
  table = { index, values };
  return values;
}

/**
 * Le décalage à la profondeur t du biseau, normalisé : 1 au maximum (juste à
 * l'intérieur du bord), 0 au ras du bord et au-delà du biseau.
 */
export function lensProfile(t: number, index = GLASS_INDEX): number {
  if (t <= 0 || t >= 1) return 0;
  const values = tableFor(index);
  const position = t * SAMPLES;
  const low = Math.floor(position);
  const fraction = position - low;
  return values[low] + (values[Math.min(low + 1, SAMPLES)] - values[low]) * fraction;
}
