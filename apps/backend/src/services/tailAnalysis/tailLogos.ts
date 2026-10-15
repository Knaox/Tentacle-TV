/**
 * Les LOGOS de fin — Pixar, Netflix, Marvel, ABC… — qui ne sont jamais des scènes.
 *
 * Le premier détecteur ne reconnaissait un logo qu'en MUSIQUE et collé au bout
 * du fichier. Or le château Disney de fin est souvent muet, la lampe Pixar
 * sautille dans des bruitages, et 25 à 35 s de noir suivent parfois les
 * logos : « Toy Story », « Cars 2 », « Là-haut », « WALL·E » (quarante secondes
 * de gag sur le logo, en bruitages), « Élémentaire », « Les Indestructibles »
 * proposaient tous une scène post-générique qui était le logo.
 *
 * Le son ne tranchait pas (et il n'est plus écouté : l'analyse audio est
 * retirée) : plusieurs vraies scènes de fin sont presque muettes (le shawarma
 * d'« Avengers », « Ted 2 »). L'IMAGE tranche : ces logos finissent sur un FOND CLAIR
 * UNI — la lampe Pixar sur son gris, le « N » de Netflix — mesuré sur la
 * dernière vignette (fond uni ≥ 0,65, noir ≤ 0,1). Sur 62 vraies scènes finales
 * du banc, une seule finit ainsi (« Brave New World », 47 s, très parlée).
 *
 * Un logo, c'est donc une plage d'image d'au plus 45 s (le château Disney du centenaire
 * en dure 40 — « Toy Story 5 », « Jumpers » ; 55 s si la moitié de ses
 * vignettes sont ce fond clair : le gag de WALL·E) qui finit sur ce fond, ou juste
 * avant, et après laquelle il n'y a plus que du noir, des cartons ou le fond clair.
 */

import type { Timeline } from "./tailTimeline";

const FLAT_MODAL_MIN = 0.65;
const FLAT_DARK_MAX = 0.1;
const LOGO_SHORT_MS = 45_000;
const LOGO_LONG_MS = 55_000;
const FLAT_SHARE_LONG = 0.5;
/** Ce qui peut suivre un logo : noir, cartons, défilement, aplat, texte clair, rien. */
const END_MATTER = "KCTUL?";

/** La vignette qui couvre `ms` est-elle un fond clair uni ? */
export function flatLight(t: Timeline, ms: number): boolean {
  const m = t.measure(ms);
  return m !== null && m.modal >= FLAT_MODAL_MIN && m.dark <= FLAT_DARK_MAX;
}

/** Les débuts des cases de [from, to), alignés sur la grille. */
function cellStarts(t: Timeline, from: number, to: number): number[] {
  const out: number[] = [];
  for (let ms = from - ((from - t.firstCellMs) % t.step); ms < to; ms += t.step) out.push(ms);
  return out;
}

/** La plage [from, to) est-elle un logo de fin ? */
export function isEndLogo(t: Timeline, from: number, to: number): boolean {
  if (to - from > LOGO_LONG_MS) return false;
  const after = cellStarts(t, to, t.knownEndMs).filter((ms) => ms >= to);
  if (!after.every((ms) => END_MATTER.includes(t.cell(ms)) || flatLight(t, ms))) return false;
  // Un fondu au noir clôt souvent le logo : on juge sur la dernière vignette qui ne l'est pas.
  const inside = cellStarts(t, from, to);
  while (inside.length > 1 && t.cell(inside[inside.length - 1]) === "K") inside.pop();
  if (inside.length === 0) return false;
  if (!flatLight(t, inside[inside.length - 1]) && !(after.length > 0 && flatLight(t, after[0]))) return false;
  const flat = inside.filter((ms) => flatLight(t, ms)).length;
  return to - from <= LOGO_SHORT_MS || flat / inside.length >= FLAT_SHARE_LONG;
}
