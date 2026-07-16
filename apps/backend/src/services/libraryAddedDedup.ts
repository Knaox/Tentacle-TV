import type { LibItem } from "./jellyfin";

// Anti-doublon des notifs d'ajout bibliothèque : quand un plugin (ex. Seer) a
// « revendiqué » un contenu (table content_claims), on n'envoie PAS la notif
// biblio de ce contenu à l'utilisateur concerné — le plugin le notifie déjà.
// Générique : le core ne connaît pas le plugin, juste (tmdbId | titre, user).

export interface Claim {
  tmdbId: number;
  jellyfinUserId: string;
  title: string;
}

export interface UserClaims {
  tmdbs: Set<number>;
  titles: Set<string>;
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

/** Indexe les claims par utilisateur (tmdb + titres normalisés) pour un match O(1). */
export function indexClaims(claims: Claim[]): Map<string, UserClaims> {
  const map = new Map<string, UserClaims>();
  for (const c of claims) {
    let e = map.get(c.jellyfinUserId);
    if (!e) {
      e = { tmdbs: new Set(), titles: new Set() };
      map.set(c.jellyfinUserId, e);
    }
    e.tmdbs.add(c.tmdbId);
    if (c.title) e.titles.add(normalizeTitle(c.title));
  }
  return map;
}

/**
 * Vrai si l'item est revendiqué pour cet utilisateur :
 *  - épisode/saison : match par tmdbId de la SÉRIE (seriesTmdbId, résolu à part) —
 *    le claim Seer porte le tmdb série ; le `tmdbId` d'un Episode est celui de
 *    l'épisode, jamais de la série (donc on ne le teste PAS pour un épisode) ;
 *  - film/série : match par tmdbId de l'item ;
 *  - repli commun : nom de série normalisé (si le tmdb n'a pas pu être résolu).
 */
export function isClaimed(item: LibItem, claim: UserClaims | undefined): boolean {
  if (!claim) return false;
  if (item.seriesTmdbId != null && claim.tmdbs.has(item.seriesTmdbId)) return true;
  if (item.Type !== "Episode" && item.tmdbId != null && claim.tmdbs.has(item.tmdbId)) return true;
  const seriesName = item.SeriesName ?? (item.Type === "Series" ? item.Name : undefined);
  if (seriesName && claim.titles.has(normalizeTitle(seriesName))) return true;
  return false;
}
