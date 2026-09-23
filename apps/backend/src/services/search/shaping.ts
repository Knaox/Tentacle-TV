/**
 * Du catalogue à l'écran : un titre du catalogue devient un `SearchMediaItem` RÉDUIT
 * — ce que les cartes de l'app lisent (affiche par son tag, année, note, fin de
 * diffusion, reprise, vu, favori) — et rien de plus. Une grille de résultats
 * se peint ainsi sans un seul aller-retour vers Jellyfin, et ses images sont
 * adressées par contenu (le tag), donc servies du cache.
 */

import type { SearchItemHit, SearchMatch, SearchMediaItem, SearchPersonHit, SearchUserData } from "../../search/searchTypes";
import type { CatalogItem } from "./catalogSource";
import type { EnginePerson } from "./engine";

/** Les genres qu'une carte peut afficher — au-delà, ce serait du bruit. */
const GENRES_KEPT = 3;

export function toMediaItem(item: CatalogItem, userData: SearchUserData | undefined): SearchMediaItem {
  return {
    Id: item.id,
    Name: item.name,
    Type: item.type,
    ...(item.originalTitle !== null ? { OriginalTitle: item.originalTitle } : {}),
    ...(item.year !== null ? { ProductionYear: item.year } : {}),
    ...(item.endDate !== null ? { EndDate: item.endDate } : {}),
    ...(item.rating !== null ? { CommunityRating: item.rating } : {}),
    ...(item.officialRating !== null ? { OfficialRating: item.officialRating } : {}),
    ...(item.runTimeTicks !== null ? { RunTimeTicks: item.runTimeTicks } : {}),
    ...(item.status !== null ? { Status: item.status } : {}),
    ...(item.childCount !== null ? { ChildCount: item.childCount } : {}),
    ...(item.primaryAspect !== null ? { PrimaryImageAspectRatio: item.primaryAspect } : {}),
    Genres: item.genres.slice(0, GENRES_KEPT),
    ImageTags: item.imageTags,
    BackdropImageTags: item.backdropTag === null ? [] : [item.backdropTag],
    ...(userData !== undefined ? { UserData: userData } : {}),
  };
}

export function toItemHit(
  item: CatalogItem,
  userData: SearchUserData | undefined,
  match: SearchMatch,
  score: number,
): SearchItemHit {
  return { item: toMediaItem(item, userData), match, score: Math.round(score * 1000) / 1000 };
}

/** Les rôles d'une personne, les plus tenus d'abord : « Réalisateur » avant « Scénariste ». */
export function toPersonHit(person: EnginePerson, visibleCount: number, score: number): SearchPersonHit {
  const roles = [...person.roles.entries()].sort((a, b) => b[1] - a[1]).map(([role]) => role);
  return {
    id: person.id,
    name: person.name,
    imageTag: person.imageTag,
    roles,
    count: visibleCount,
    score: Math.round(score * 1000) / 1000,
  };
}
