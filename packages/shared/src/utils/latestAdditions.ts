import type { TFunction } from "i18next";
import type { MediaItem } from "../types/media";

/**
 * Une carte REGROUPÉE des « Derniers ajouts » — la série qui rassemble ses
 * épisodes et ses saisons récents (cf. `LatestAdditions`) — dit ce qu'elle
 * apporte de neuf en une ligne discrète de sa légende, à la place de l'année :
 * « 3 nouveaux épisodes », « Nouvelle saison », « Nouvelle série ». La même
 * ligne sur toutes les plateformes ; aucune carte ne l'écrit en dur.
 *
 * La plus forte nouveauté l'emporte : la série entière, sinon ses saisons
 * nouvelles, sinon le compte de ses épisodes. Face à un serveur plus ancien,
 * la tuile que le client fabrique (`groupLatestByRuns`, « +N ») dit son
 * compte de la même façon.
 *
 * Ouvrir la carte mène à la fiche de la série, sur la saison de l'ajout le
 * plus récent (`latestAdditionsSeasonId`).
 */

export interface LatestAdditionsCaption {
  /** Clé de l'espace `cards`. */
  key: "cards:newSeries" | "cards:newSeasons" | "cards:newEpisodes";
  count?: number;
}

/** Ce que dit la ligne, ou `null` : la carte n'est pas un regroupement. */
export function latestAdditionsCaption(item: MediaItem): LatestAdditionsCaption | null {
  const additions = item.LatestAdditions;
  if (additions) {
    if (additions.NewSeries) return { key: "cards:newSeries" };
    const seasons = additions.NewSeasonNumbers.length;
    if (seasons > 0) return { key: "cards:newSeasons", count: seasons };
    return additions.EpisodeCount > 0 ? { key: "cards:newEpisodes", count: additions.EpisodeCount } : null;
  }
  const count = item.RecentlyAddedCount ?? 0;
  return count > 1 ? { key: "cards:newEpisodes", count } : null;
}

/** La ligne, traduite — `null` quand la carte garde sa légende ordinaire. */
export function latestAdditionsLine(t: TFunction, item: MediaItem): string | null {
  const caption = latestAdditionsCaption(item);
  if (!caption) return null;
  return caption.count === undefined ? t(caption.key) : t(caption.key, { count: caption.count });
}

/** La saison sur laquelle ouvrir la fiche d'une carte regroupée — celle de son dernier ajout. */
export function latestAdditionsSeasonId(item: MediaItem): string | undefined {
  return item.LatestAdditions?.LatestSeasonId ?? undefined;
}
