/**
 * La largeur d'un texte en Inter, calculée sans le rendre — pour décider AVANT
 * le dessin ce qui tient dans une place étroite (les badges de qualité d'une
 * affiche, à côté de sa note).
 *
 * Chasses d'avance relevées dans les tables `hmtx` des polices embarquées
 * (`apps/tv/assets/fonts`, 2048 unités par cadratin), en cadratins. Sans le
 * crénage : la somme est une borne HAUTE — ce qui est dit tenir tient.
 * Seulement les caractères des pastilles (chiffres, capitales, « . », « + »,
 * « · », espace) ; un autre compte pour la plus large des capitales courantes.
 */

type Weight = "bold" | "extrabold";

const BOLD: Readonly<Record<string, number>> = {
  "0": 0.674, "1": 0.431, "2": 0.63, "3": 0.646, "4": 0.676, "5": 0.622, "6": 0.649, "7": 0.582, "8": 0.651, "9": 0.649,
  A: 0.747, B: 0.662, C: 0.74, D: 0.722, E: 0.607, F: 0.587, G: 0.75, H: 0.747, I: 0.281, J: 0.584, K: 0.719, L: 0.565, M: 0.932,
  N: 0.762, O: 0.771, P: 0.648, Q: 0.777, R: 0.657, S: 0.655, T: 0.667, U: 0.732, V: 0.747, W: 1.038, X: 0.738, Y: 0.731, Z: 0.664,
  " ": 0.237, "+": 0.679, "·": 0.334, ".": 0.334,
};

const EXTRABOLD: Readonly<Record<string, number>> = {
  "0": 0.692, "1": 0.441, "2": 0.638, "3": 0.657, "4": 0.688, "5": 0.634, "6": 0.662, "7": 0.588, "8": 0.664, "9": 0.662,
  " ": 0.219, "+": 0.686, "·": 0.353, ".": 0.353,
};

/** Un caractère hors de la table : la chasse d'une capitale large (« O »). */
const FALLBACK = 0.78;

/** La largeur de `text` en points, à `size`, avec l'interlettrage `letterSpacing`
 *  (ajouté après chaque caractère, comme le fait iOS). */
export function interTextWidth(text: string, size: number, weight: Weight, letterSpacing = 0): number {
  const table = weight === "bold" ? BOLD : EXTRABOLD;
  let em = 0;
  let count = 0;
  for (const char of text) {
    em += table[char] ?? BOLD[char] ?? FALLBACK;
    count += 1;
  }
  return em * size + letterSpacing * count;
}
