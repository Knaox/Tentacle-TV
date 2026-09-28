import type { SharedListItem } from "@tentacle-tv/api-client";

export interface ShareSummary {
  total: number;
  movies: number;
  series: number;
  /** Titres likés absents du serveur (pas d'Id Jellyfin) : ni fiche ni ajout. */
  offServer: number;
  /** Titres qu'un visiteur connecté peut cocher (présents sur le serveur). */
  selectable: string[];
}

/** Le bilan d'une liste partagée — une passe, sans requête. */
export function summarizeSharedList(items: readonly SharedListItem[]): ShareSummary {
  const summary: ShareSummary = { total: items.length, movies: 0, series: 0, offServer: 0, selectable: [] };
  for (const item of items) {
    if (item.Type === "Movie") summary.movies += 1;
    else if (item.Type === "Series") summary.series += 1;
    if (item.Id) summary.selectable.push(item.Id);
    else summary.offServer += 1;
  }
  return summary;
}

/**
 * Affiche d'un titre partagé : le proxy public de Jellyfin pour la
 * bibliothèque (un visiteur n'a pas de jeton), l'affiche TMDB sinon.
 */
export function sharedPosterUrl(item: SharedListItem): string | null {
  if (!item.Id) return item.PosterUrl ?? null;
  const tag = item.ImageTags?.Primary;
  const params = `fillHeight=450&quality=90${tag ? `&tag=${tag}` : ""}`;
  return `/api/jellyfin/Items/${item.Id}/Images/Primary?${params}`;
}
