/**
 * La hauteur que la piste d'une rangée RÉSERVE, cartes montées ou non.
 *
 * Module PUR — des nombres : `useRowTrackReserve` mesure et retient.
 *
 * # Pourquoi
 *
 * Une rangée n'a pas toujours ses cartes : elles ne sont montées qu'à son
 * entrée dans l'écran (la cascade d'apparition), et sa fenêtre se VIDE quand
 * elle en sort (`useRowWindow`). Sans réserve, la piste retombait alors à ses
 * seules marges (56 px) : une rangée de 450 px en faisait 86. Mesuré au banc
 * sur « Pour vous » (1440 × 900) : ±365 px de `scrollHeight` à chaque rangée
 * croisée, et, à la remontée, des corrections d'ancrage de 365 px — la barre
 * de défilement sautait sous le doigt. Pire, `content-visibility: auto`
 * MÉMORISE la taille d'une rangée vidée encore rendue : elle restait écrasée
 * hors écran, et regrandissait en y revenant.
 *
 * Les cales de la piste portent donc la hauteur d'une carte tant qu'aucune
 * carte n'est là : la rangée garde sa taille finale dès sa naissance.
 */

export type RowCardShape = "poster" | "episode";

/** Hauteur de l'image rapportée à sa largeur : affiche 2:3, vignette 16:9. */
const IMAGE_RATIO: Record<RowCardShape, number> = { poster: 3 / 2, episode: 9 / 16 };

/**
 * Le bloc titre sous l'image, au premier passage : `mt-2` + `min-h-[40px]`
 * (cartes de recommandation), `mt-2.5` + titre + ligne d'appoint (accueil).
 * Une estimation seulement : dès qu'une carte est mesurée, sa vraie hauteur
 * prend le relais (`reservedCardHeight`).
 */
export const CARD_CAPTION_ESTIMATE = 48;

/**
 * Ce qui entoure les cartes dans une rangée : l'en-tête (26 px + `mb-1`) et
 * les marges de la piste (`pt-8`, `pb-6`). Mesuré : 30 + 56.
 */
export const ROW_CHROME_HEIGHT = 86;

export function estimateCardHeight(cardWidth: number, shape: RowCardShape): number {
  return cardWidth * IMAGE_RATIO[shape] + CARD_CAPTION_ESTIMATE;
}

/**
 * La hauteur à réserver : celle mesurée sur CETTE rangée, sinon celle d'une
 * rangée sœur de même gabarit (même genre de carte, même largeur), sinon
 * l'estimation. `null` quand la largeur n'est pas connue en JS (mobile) :
 * rien n'est réservé, comme avant.
 */
export function reservedCardHeight(input: {
  cardWidth: number | null;
  shape: RowCardShape;
  measured: number | null;
  sibling: number | null;
}): number | null {
  if (input.cardWidth == null || input.cardWidth <= 0) return null;
  if (input.measured != null && input.measured > 0) return input.measured;
  if (input.sibling != null && input.sibling > 0) return input.sibling;
  return estimateCardHeight(input.cardWidth, input.shape);
}

/**
 * La taille qu'une rangée jamais rendue occupe hors écran
 * (`contain-intrinsic-size`) : la même que rendue, à toute largeur de
 * fenêtre — la constante de 450 px de `rendering.css` ne valait que vers
 * 1440 px de large.
 */
export function rowIntrinsicHeight(cardHeight: number): number {
  return Math.round(ROW_CHROME_HEIGHT + cardHeight);
}

/**
 * Clé des rangées sœurs : le genre de carte (son bloc titre) et sa largeur,
 * au demi-pixel. Deux rangées de même clé ont des cartes de même hauteur à
 * une ligne de légende près.
 */
export function cardHeightKey(kind: string, cardWidth: number): string {
  return `${kind}:${Math.round(cardWidth * 2) / 2}`;
}
