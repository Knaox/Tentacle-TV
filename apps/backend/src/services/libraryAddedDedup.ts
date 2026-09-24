import type { LibItem } from "./jellyfinLibrary";

// Qui attend quoi : un plugin de demandes (ex. Vigie) « revendique » un
// contenu pour un utilisateur tant que sa demande attend (table
// content_claims). À l'arrivée du contenu dans Jellyfin, le notifier d'ajouts
// l'annonce à ce demandeur, sous sa forme personnelle. Générique : le core ne
// connaît pas le plugin, juste (tmdbId | titre, user).

export interface Claim {
  tmdbId: number;
  jellyfinUserId: string;
  title: string;
  mediaType: string; // movie | tv
}

/** Ce qu'attend un utilisateur. Films et séries à part : TMDB numérote les
 *  deux dans des espaces DISTINCTS qui se chevauchent — le film 1399 n'est
 *  pas la série 1399. */
export interface UserClaims {
  movies: Set<number>;
  shows: Set<number>;
  showTitles: Set<string>;
}

/** Normalise un titre pour le match tolérant (casse, accents, ponctuation). */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Indexe les claims par utilisateur (tmdb par espace + titres de séries) pour un match O(1). */
export function indexClaims(claims: Claim[]): Map<string, UserClaims> {
  const map = new Map<string, UserClaims>();
  for (const c of claims) {
    let e = map.get(c.jellyfinUserId);
    if (!e) {
      e = { movies: new Set(), shows: new Set(), showTitles: new Set() };
      map.set(c.jellyfinUserId, e);
    }
    if (c.mediaType === "movie") {
      e.movies.add(c.tmdbId);
    } else {
      e.shows.add(c.tmdbId);
      if (c.title) e.showTitles.add(normalizeTitle(c.title));
    }
  }
  return map;
}

/**
 * Vrai si l'item est revendiqué pour cet utilisateur :
 *  - film : par son tmdbId, parmi les films revendiqués ;
 *  - épisode : par le tmdbId de sa SÉRIE (seriesTmdbId, résolu à part) — le
 *    `tmdbId` d'un Episode est celui de l'épisode, jamais de la série ;
 *  - série : par son tmdbId, parmi les séries revendiquées ;
 *  - repli des séries : le nom normalisé (si le tmdb n'a pas pu être résolu).
 */
export function isClaimed(item: LibItem, claim: UserClaims | undefined): boolean {
  if (!claim) return false;
  if (item.Type === "Movie") return item.tmdbId != null && claim.movies.has(item.tmdbId);
  if (item.seriesTmdbId != null && claim.shows.has(item.seriesTmdbId)) return true;
  if (item.Type === "Series" && item.tmdbId != null && claim.shows.has(item.tmdbId)) return true;
  const seriesName = item.SeriesName ?? (item.Type === "Series" ? item.Name : undefined);
  return !!seriesName && claim.showTitles.has(normalizeTitle(seriesName));
}
