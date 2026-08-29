/**
 * Un pas, ou un bord ? La décision, en nombres.
 *
 * Quand aucun voisin n'a été trouvé, le moteur a deux réponses possibles et
 * elles n'ont rien à voir l'une avec l'autre. Soit la cible existe mais n'est
 * pas montée — le fenêtrage a vidé sa rangée — et il faut faire UN PAS pour la
 * révéler, puis viser à nouveau, puis rendre le terrain si rien n'a bougé.
 * Soit il n'y a réellement plus rien dans cette direction, et l'appui demande
 * autre chose : voir le BOUT de la page. Une bannière au-dessus de la première
 * carte, un pied sous la dernière — du décor sans anneau, mais du contenu
 * qu'on veut lire.
 *
 * Le protocole des pas répondait aux deux, et il répondait mal à la seconde.
 * Un pas vaut `min(hauteur du départ + margin, 0,4 × écran)` — sur un BOUTON de
 * 48 px, cela fait 144 px, et deux pas 288. Au-delà, aucun n'accoste, tout est
 * révoqué, et l'on voit la barre de défilement monter puis redescendre. Or le
 * mou au-dessus du premier élément d'une page vaut 240 à 320 px : toutes les
 * pages du client se pressent SUR ce seuil, à quelques pixels près. D'où un
 * défaut qui paraissait capricieux — trois pixels de bannière en plus, une
 * hauteur d'écran différente, et il change de camp.
 *
 * Deux verrous, et il faut les deux :
 *
 * - **aucun candidat au-delà**, dans tout le document. C'est ce qui protège le
 *   protocole des pas : tant qu'une piste existe plus bas, fût-elle hors de la
 *   fenêtre de recensement, on la révèle par pas — on ne saute pas par-dessus ;
 * - **un mou inférieur à un écran**. C'est ce qui protège de la
 *   virtualisation : une grille de bibliothèque retire ses rangées du document
 *   au-delà de son overscan, et « aucun candidat » y devient vrai à tort. Mais
 *   il reste alors des milliers de pixels à défiler, quand le bout d'une vraie
 *   page tient en trois cents.
 *
 * Module PUR : il ne connaît ni le DOM, ni les scrollers, ni les directions. Le
 * seul renseignement qu'il reçoit du document est un booléen. C'est ce qui rend
 * la règle testable, et elle a besoin de l'être — elle est passée deux fois au
 * travers d'une vérification à l'œil.
 */

export type Decision =
  /** Rejoindre le bord en UN mouvement, qui ne sera jamais révoqué. */
  | { type: "bord"; delta: number }
  /** Un pas de révélation, révocable — `docked` s'il a consommé tout le mou. */
  | { type: "pas"; step: number; docked: boolean }
  /** Rien à faire : plus rien ne peut défiler dans cette direction. */
  | { type: "none" };

export interface ScrollState {
  /** Ce qui reste à défiler dans la direction demandée. */
  slack: number;
  /** Hauteur (ou largeur) de l'élément d'où l'on part. */
  startHeight: number;
  /** Hauteur (ou largeur) visible du scroller, ou de la fenêtre. */
  view: number;
  /** La marge du cadrage, qui entre dans la taille d'un pas. */
  margin: number;
  /** Fraction de la vue au-delà de laquelle un pas ne va jamais. */
  ceiling: number;
  /** Mou maximal qu'on accepte de consommer d'un seul coup. */
  threshold: number;
  /** Reste-t-il un focusable dans cette direction, dans tout le document ? */
  candidateBeyond: boolean;
}

/** La taille d'un pas : une rangée, plafonnée à une fraction de l'écran. */
export function stepSize(startHeight: number, view: number, margin: number, ceiling: number) {
  return Math.min(startHeight + margin, view * ceiling);
}

export function decide(state: ScrollState): Decision {
  const { slack, startHeight, view, margin, ceiling, threshold, candidateBeyond } = state;

  // Moins d'un pixel à défiler : on est au bord, il n'y a rien à décider. Le
  // seuil d'un pixel plutôt que zéro parce que les positions de défilement sont
  // fractionnaires sur un écran mis à l'échelle, et qu'un pas d'un demi-pixel
  // n'est pas un pas — c'est une oscillation.
  if (slack < 1) return { type: "none" };

  // Le bout de la page : plus rien à viser au-delà, et le reste tient dans un
  // écran. On le rejoint d'un trait, et l'on y reste — c'est une destination,
  // pas un pas de révélation qu'on rendrait faute de focus déplacé.
  if (!candidateBeyond && slack <= threshold) return { type: "bord", delta: slack };

  const step = Math.min(stepSize(startHeight, view, margin, ceiling), slack);
  return { type: "pas", step, docked: step >= slack };
}
