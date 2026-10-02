import type { MediaItem } from "../types/media";

/**
 * Une carte REGROUPÉE des « Derniers ajouts » — la série qui rassemble ses
 * épisodes et ses saisons récents (cf. `LatestAdditions`) — dit ce qu'elle
 * apporte de neuf en une ligne discrète de sa légende, à la place de l'année :
 * « 3 nouveaux épisodes », « Nouvelle saison · 8 épisodes », « Nouvelle
 * série · 8 épisodes ». La même ligne sur toutes les plateformes ; aucune
 * carte ne l'écrit en dur.
 *
 * La plus forte nouveauté l'emporte — la série entière, sinon ses saisons
 * nouvelles, sinon ses épisodes —, et le nombre d'épisodes du groupe se lit
 * toujours. Face à un serveur plus ancien, la tuile que le client fabrique
 * (`groupLatestByRuns`, « +N ») dit son compte de la même façon.
 *
 * Ouvrir la carte mène à la fiche de la série, sur la saison de l'ajout le
 * plus récent (`latestAdditionsSeasonId`).
 */

/** Un morceau de la ligne : une clé de l'espace `cards`, et son compte. */
export interface LatestAdditionsPart {
  key: "cards:newSeries" | "cards:newSeasons" | "cards:newEpisodes" | "cards:episodeCount";
  count?: number;
}

/** Ce que dit la ligne, morceau par morceau, ou `null` : la carte n'est pas un regroupement. */
export function latestAdditionsCaption(item: MediaItem): LatestAdditionsPart[] | null {
  const additions = item.LatestAdditions;
  if (additions) {
    const episodes = additions.EpisodeCount;
    const counted: LatestAdditionsPart[] = episodes > 0 ? [{ key: "cards:episodeCount", count: episodes }] : [];
    if (additions.NewSeries) return [{ key: "cards:newSeries" }, ...counted];
    const seasons = additions.NewSeasonNumbers.length;
    if (seasons > 0) return [{ key: "cards:newSeasons", count: seasons }, ...counted];
    return episodes > 0 ? [{ key: "cards:newEpisodes", count: episodes }] : null;
  }
  const count = item.RecentlyAddedCount ?? 0;
  return count > 1 ? [{ key: "cards:newEpisodes", count }] : null;
}

/** La traduction d'une clé — celle d'i18next, ou celle qu'un écran reçoit. */
type Translate = (key: string, options?: { count: number }) => string;

/**
 * Entre deux morceaux : le point médian collé à ce qui le précède (espace
 * insécable), et une coupure possible après lui — une carte étroite passe à
 * la ligne avant le compte : « Nouvelle saison · » / « 8 épisodes ».
 */
const SEPARATOR = "\u00A0· ";

/**
 * La ligne, traduite — `null` quand la carte garde sa légende ordinaire. Elle
 * peut prendre DEUX lignes sur une carte étroite : le nombre d'épisodes se lit
 * toujours, il n'est jamais coupé par une ellipse.
 */
export function latestAdditionsLine(t: Translate, item: MediaItem): string | null {
  const parts = latestAdditionsCaption(item);
  if (!parts) return null;
  return parts.map((part) => (part.count === undefined ? t(part.key) : t(part.key, { count: part.count }))).join(SEPARATOR);
}

/** La saison sur laquelle ouvrir la fiche d'une carte regroupée — celle de son dernier ajout. */
export function latestAdditionsSeasonId(item: MediaItem): string | undefined {
  return item.LatestAdditions?.LatestSeasonId ?? undefined;
}

/** Le paramètre d'adresse d'une fiche de série qui s'ouvre sur une saison (web, bureau, mobile). */
export const DETAIL_SEASON_PARAM = "season";

/** « ?season=… » : la fiche d'une carte regroupée, ouverte sur sa saison ; rien pour une autre carte. */
export function latestAdditionsDetailQuery(item: MediaItem): string {
  const seasonId = latestAdditionsSeasonId(item);
  return seasonId ? `?${DETAIL_SEASON_PARAM}=${encodeURIComponent(seasonId)}` : "";
}
