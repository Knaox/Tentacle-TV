import type { Direction } from "../remote/intents";

/**
 * La BANNIÈRE de l'accueil et de « Pour vous » : UNE seule cible (décision de
 * Damien du 19/10, d'après la Top Shelf d'Apple — « Swiping … pans to the next
 * or previous banner » — et les pastilles de page de tvOS : « Inclusion of
 * additional controls makes it difficult to maintain focus while moving
 * between pages »). Aucun bouton dedans, donc aucun conflit entre « le bouton
 * voisin » et « le titre voisin » :
 *
 * - DROITE : le titre suivant, en boucle ;
 * - GAUCHE : le titre précédent ; sur le premier, le rail — comme depuis la
 *   première carte d'une rangée ;
 * - BAS : les rangées ; HAUT : rien (la bannière est en haut de la page) ;
 * - OK : la fiche, ou la demande hors bibliothèque (`cards/cardPress.ts`) ;
 *   OK maintenu : le grand panneau (`cards/cardHold.ts`).
 *
 * Module pur : l'intégration applique le résultat.
 */

export type HeroMove =
  | { kind: "slide"; index: number; direction: 1 | -1 }
  | { kind: "rail" }
  | { kind: "rows" }
  | { kind: "stay" };

export function heroMove(direction: Direction, index: number, count: number): HeroMove {
  if (direction === "bas") return { kind: "rows" };
  if (direction === "haut") return { kind: "stay" };
  if (direction === "droite") return count > 1 ? { kind: "slide", index: (index + 1) % count, direction: 1 } : { kind: "stay" };
  return index > 0 ? { kind: "slide", index: index - 1, direction: -1 } : { kind: "rail" };
}

/** Les chevrons discrets de la bannière focalisée : où l'on peut encore tourner. */
export function heroChevrons(index: number, count: number): { back: boolean; forward: boolean } {
  return { back: count > 1 && index > 0, forward: count > 1 };
}
