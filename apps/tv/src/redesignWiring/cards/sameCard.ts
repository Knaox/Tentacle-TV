import type { CardMarkers } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";

/**
 * Deux modèles de carte disent-ils la même chose ? Sert à garder l'objet
 * précédent quand rien n'a changé : les cartes sont mémoïsées, un objet neuf
 * les redessinerait toutes pour rien. Les palettes viennent d'un cache par
 * empreinte (`cardArtwork.ts`) : l'identité suffit.
 */

function sameMarkers(a: CardMarkers, b: CardMarkers): boolean {
  return (
    a.communityRating === b.communityRating &&
    a.userScore === b.userScore &&
    a.device === b.device &&
    a.statuses.length === b.statuses.length &&
    a.statuses.every((status, i) => status === b.statuses[i])
  );
}

export function sameCard(a: CardModel, b: CardModel): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.landscapeUri === b.landscapeUri &&
    a.posterUri === b.posterUri &&
    a.logoUri === b.logoUri &&
    a.progress === b.progress &&
    a.badge === b.badge &&
    a.focusNote === b.focusNote &&
    a.palette === b.palette &&
    sameMarkers(a.markers, b.markers)
  );
}
