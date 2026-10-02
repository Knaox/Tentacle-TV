import type { LatestCard } from "./latestGrouping";

/**
 * Les cartes rendues au client : les `BaseItemDto` de Jellyfin, dans l'ordre
 * de la rangée — et, sur une série regroupée, ce qu'elle apporte de neuf.
 *
 * Deux champs Tentacle s'ajoutent à la série, rien n'est retiré ni réécrit :
 * - `LatestAdditions` (contrat partagé) : nombre d'épisodes, saisons
 *   concernées, saisons ou série nouvelles, dernier ajout et sa saison ;
 * - `RecentlyAddedCount` : le nombre d'épisodes, que les clients déjà
 *   installés lisent sur leurs tuiles de lot (pastille « +3 », « +3
 *   épisodes ») — ils montrent donc la carte regroupée comme les leurs.
 *
 * Une carte dont Jellyfin ne rend pas l'élément (retiré entre les deux
 * requêtes, ou caché au compte) disparaît plutôt que de partir vide.
 */

export interface JellyfinItem {
  Id?: unknown;
  [field: string]: unknown;
}

export function assembleLatestItems(plan: readonly LatestCard[], details: readonly JellyfinItem[]): JellyfinItem[] {
  const byId = new Map<string, JellyfinItem>();
  for (const item of details) if (typeof item.Id === "string") byId.set(item.Id, item);

  const out: JellyfinItem[] = [];
  for (const card of plan) {
    const item = byId.get(card.kind === "series" ? card.seriesId : card.id);
    if (!item) continue;
    if (card.kind === "item") {
      out.push(item);
      continue;
    }
    const count = card.additions.EpisodeCount;
    out.push({ ...item, ...(count > 0 ? { RecentlyAddedCount: count } : {}), LatestAdditions: card.additions });
  }
  return out;
}

/** La réponse, sous la forme de celle de `/Items` que le client attendait. */
export function latestResponseBody(items: readonly JellyfinItem[]): string {
  return JSON.stringify({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
}
