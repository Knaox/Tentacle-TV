import { trailerPreviewSubjectKey, type CardMarkers, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { sameQuality } from "./cardQuality";

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

function sameTrailer(a: TrailerPreviewSubject | undefined, b: TrailerPreviewSubject | undefined): boolean {
  if (!a || !b) return a === b;
  return trailerPreviewSubjectKey(a) === trailerPreviewSubjectKey(b);
}

export function sameCard(a: CardModel, b: CardModel): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.subtitleLines === b.subtitleLines &&
    a.landscapeUri === b.landscapeUri &&
    a.posterUri === b.posterUri &&
    a.logoUri === b.logoUri &&
    a.billboard?.backdropUri === b.billboard?.backdropUri &&
    a.billboard?.logoUri === b.billboard?.logoUri &&
    a.progress === b.progress &&
    a.badge === b.badge &&
    a.focusNote === b.focusNote &&
    a.palette === b.palette &&
    sameQuality(a.quality, b.quality) &&
    sameTrailer(a.trailer, b.trailer) &&
    sameMarkers(a.markers, b.markers)
  );
}
