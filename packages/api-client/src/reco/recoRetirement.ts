import type { QueryClient } from "@tanstack/react-query";
import { resolveCardMarkers, titleKey, type MediaItem } from "@tentacle-tv/shared";
import type { RecoRowItem } from "../hooks/recoTypes";
import { userScoreFromRatings } from "../hooks/useCardMarkers";
import type { UserRatingEntry } from "../hooks/useRatings";
import { dropRecoItemEverywhere } from "../hooks/useRecoPage";
import { seriesStateId } from "../hooks/useSeriesListMembership";
import { WATCHLIST_PENDING_KEY } from "../hooks/useWatchlistPending";
import { FAVORITE_SERIES_IDS_KEY, WATCHLIST_SERIES_IDS_KEY } from "../hooks/watchlistEffects";
import { recoItemsOf } from "./recoCacheItems";
import { isRecoItemHeld, markRecoRetired, unholdRecoCard } from "./recoRetirementState";
import { recoMarkerItem } from "./useRecoMarkerItem";

/**
 * « Pour vous » ne propose que ce qu'on n'a pas encore jugé : un titre ajouté
 * à Ma liste, aimé (le cœur), marqué vu ou noté en SORT — mais seulement
 * quand l'utilisateur LÂCHE la carte. Sur le web et le bureau, quand le
 * pointeur quitte la rangée (retirer une carte plus tôt ferait glisser sa
 * voisine sous le curseur) ; sur le mobile, le miroir et la TV, quand la
 * feuille d'actions se referme. Tant qu'elle est tenue, la carte reste, et le
 * geste s'y défait sur place.
 *
 * « Jugé » se lit au lâcher, dans les caches mêmes que les marqueurs de la
 * carte affichent (`resolveCardMarkers`) : la pastille d'états (Ma liste,
 * favori, vu) ou une note. Une carte hors bibliothèque (Vigie) est jugée
 * quand elle est mise de côté pour Ma liste, ou notée.
 */

/** Le titre porte-t-il un jugement, d'après les caches des marqueurs de carte ? */
export function isRecoItemJudged(qc: QueryClient, item: RecoRowItem): boolean {
  const cached = item.jellyfinItemId ? qc.getQueryData<MediaItem>(["item", item.jellyfinItemId]) : undefined;
  const face = cached ?? recoMarkerItem(item);
  const seriesId = seriesStateId(face);
  const inSeriesSet = (key: readonly string[]): boolean | undefined => {
    if (!seriesId) return undefined;
    const ids = qc.getQueryData<string[]>(key);
    return ids ? ids.includes(seriesId) : undefined;
  };
  // Hors bibliothèque, Ma liste est une mise de côté jusqu'à l'arrivée.
  const pending = !item.jellyfinItemId
    && (qc.getQueryData<string[]>(WATCHLIST_PENDING_KEY) ?? []).includes(titleKey(item.mediaType, item.tmdbId));
  const ratings = qc.getQueryData<UserRatingEntry[]>(["ratings"]);
  const markers = resolveCardMarkers({
    item: face,
    communityRating: null,
    userScore: ratings ? userScoreFromRatings(ratings, face) : null,
    inWatchlist: pending || inSeriesSet(WATCHLIST_SERIES_IDS_KEY),
    isFavorite: inSeriesSet(FAVORITE_SERIES_IDS_KEY),
  });
  return markers.statuses.length > 0 || markers.userScore !== null;
}

/** Retire le titre de toutes les pages chargées, et de celles servies ensuite. */
export function retireRecoItem(qc: QueryClient, key: string): void {
  markRecoRetired(key);
  void dropRecoItemEverywhere(qc, key);
}

/**
 * Lâche une prise sur une carte. Quand plus rien ne la tient, chaque
 * recommandation qu'elle désigne sort des rangées si elle est jugée.
 */
export function releaseRecoCard(qc: QueryClient, id: string): void {
  if (!unholdRecoCard(id)) return;
  for (const item of recoItemsOf(qc, id)) {
    // Encore tenue par son autre identité (la rangée par sa clé, la feuille
    // d'une TV par son item) : elle attend ce lâcher-là.
    if (isRecoItemHeld(item)) continue;
    if (isRecoItemJudged(qc, item)) retireRecoItem(qc, item.key);
  }
}
