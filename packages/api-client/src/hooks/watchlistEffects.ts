import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { updateItemUserDataInCache, patchSeriesIdSet } from "./cacheUtils";
import { recordAutoRetired, tentacleBackend, type BackendFetcher } from "./watchlistAutoRetired";
import { fetchSeriesWatchState } from "./useWatchState";

/** Query keys des Sets d'IDs de séries likées / favorites (cache = string[]). */
export const WATCHLIST_SERIES_IDS_KEY = ["watchlist-series-ids"] as const;
export const FAVORITE_SERIES_IDS_KEY = ["favorite-series-ids"] as const;

/** Listes flat (carrousel + page) à muter optimistiquement. */
export const WATCHLIST_LIST_KEYS = [["watchlist"], ["watchlist", "all"]] as const;
export const FAVORITE_LIST_KEYS = [["favorites"], ["favorites", "all"]] as const;

type Fetcher = {
  fetch: (path: string, init?: { method?: string }) => Promise<unknown>;
};

/**
 * Fraction du média au-delà de laquelle un arrêt vaut « lu jusqu'au bout » pour
 * Ma liste. Le verdict serveur seul ne suffit pas : un titre marqué vu à la
 * main (donc `Played`, position 0), lancé puis quitté dans les premières
 * secondes, ressort de Jellyfin avec sa position remise à zéro et `Played`
 * intact — sous `MinResumePct` (5 %), il ne touche pas au drapeau — et
 * passerait pour vu jusqu'au bout. La moitié se tient entre `MinResumePct` et
 * `MaxResumePct` (90 %), quels que soient leurs réglages raisonnables.
 */
export const WATCHLIST_RETIRE_MIN_FRACTION = 0.5;

/**
 * Verdict du CLIENT sur la position d'arrêt : `true`/`false` quand position et
 * durée sont connues, `null` sinon — l'appelant s'en remet alors au serveur.
 */
export function stoppedPastHalf(
  stopPositionSeconds: number | undefined,
  runtimeTicks: number | undefined,
): boolean | null {
  if (stopPositionSeconds === undefined || runtimeTicks === undefined || runtimeTicks <= 0) return null;
  return (stopPositionSeconds * TICKS_PER_SECOND) / runtimeTicks >= WATCHLIST_RETIRE_MIN_FRACTION;
}

/** La clé de `useSeriesWatchState` — c'est SON cache qu'on lit et qu'on remplit. */
function seriesWatchStateKey(seriesId: string): readonly ["series-watch-state", string] {
  return ["series-watch-state", seriesId] as const;
}

/**
 * L'état de visionnage d'une série, FRAIS : redemandé au serveur, puis posé
 * dans le cache où les fiches qui l'observent le trouvent. `refetchQueries` ne
 * suffisait pas — il ne refait que ce qui existe, et rien n'existe quand le
 * lecteur a été ouvert depuis une carte de l'accueil, une fiche d'épisode ou
 * un lien profond : la série restait alors dans Ma liste pour toujours. Réseau
 * en échec : l'état déjà en cache, sinon rien — jamais un verdict inventé.
 */
async function freshSeriesWatchState(
  qc: QueryClient,
  client: Fetcher,
  userId: string,
  seriesId: string,
): Promise<NextEpisodeResult | undefined> {
  const queryKey = seriesWatchStateKey(seriesId);
  return qc
    .fetchQuery({
      queryKey,
      queryFn: () => fetchSeriesWatchState(client, userId, seriesId),
      staleTime: 0,
      retry: false,
    })
    .catch(() => qc.getQueryData<NextEpisodeResult>(queryKey));
}

/**
 * La série est-elle dans Ma liste ? Sans réseau quand le cache sait : le Set
 * d'IDs (`useWatchlistSeriesIds`, jamais monté sur mobile) ou l'item de sa
 * fiche. Quand ni l'un ni l'autre n'est là, on demande l'item au serveur, sans
 * l'écrire dans le cache — la fiche y attend une forme plus riche (`Fields`).
 */
async function isSeriesInWatchlist(
  qc: QueryClient,
  client: Fetcher,
  userId: string,
  seriesId: string,
): Promise<boolean> {
  const set = qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY);
  if (set?.includes(seriesId)) return true;
  const cached = qc.getQueryData<MediaItem>(["item", seriesId]);
  if (cached?.UserData) return cached.UserData.Likes === true;
  if (set !== undefined) return false;
  const fresh = await client
    .fetch(`/Users/${userId}/Items/${seriesId}?EnableUserData=true`)
    .then((r) => r as MediaItem | null, () => null);
  return fresh?.UserData?.Likes === true;
}

/**
 * Retire une série de « Ma liste » (Likes) SI elle est entièrement vue.
 * Appelé à l'ARRÊT d'une lecture d'épisode — jamais sur un « marquer vu » posé
 * à la main, qui est un geste de rangement et non un visionnage.
 *
 * - « entièrement vue » : l'état de visionnage REDEMANDÉ au serveur — la
 *   lecture qui vient de s'arrêter l'a changé — et posé dans le cache
 *   `["series-watch-state", id]`, qu'une fiche l'ait créé ou non (exclut déjà
 *   la Saison 0 / spéciaux, cf. `fetchSeriesWatchState`).
 * - série encore EN DIFFUSION : retirée quand même — tout ce qui est disponible
 *   a été vu, elle n'a plus rien à proposer. Elle revient d'elle-même dès qu'un
 *   nouvel épisode entre en bibliothèque : le retrait automatique est mémorisé
 *   côté serveur (`recordAutoRetired`), à l'inverse d'un retrait manuel.
 * - n'agit que si la série est effectivement dans Ma liste (Set, UserData de
 *   l'item en cache, ou l'item demandé au serveur quand rien n'est en cache).
 * - le cache n'est patché (série + tous ses épisodes, + Set) qu'APRÈS un retrait
 *   serveur réussi : en échec, la liste continue de dire la vérité du serveur.
 *
 * Rend `true` si la série a effectivement quitté Ma liste.
 */
export async function retireSeriesFromWatchlistIfFullyWatched(
  qc: QueryClient,
  client: Fetcher,
  userId: string | null | undefined,
  seriesId: string | undefined,
  backend: BackendFetcher = tentacleBackend,
): Promise<boolean> {
  if (!seriesId || !userId) return false;

  const state = await freshSeriesWatchState(qc, client, userId, seriesId);
  if (state?.type !== "completed") return false;
  if (!(await isSeriesInWatchlist(qc, client, userId, seriesId))) return false;

  const removed = await client
    .fetch(`/Users/${userId}/Items/${seriesId}/Rating`, { method: "DELETE" })
    .then(() => true, () => false);
  if (!removed) return false;

  updateItemUserDataInCache(qc, { matchSeriesId: seriesId }, () => ({ Likes: false }));
  patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, seriesId, false);
  qc.invalidateQueries({ queryKey: ["watchlist"], refetchType: "none" });
  await recordAutoRetired(seriesId, backend);
  return true;
}

/**
 * À l'AJOUT dans « Ma liste » : si la cible est DÉJÀ entièrement vue, on la
 * remet à zéro (marquée non-vue, progression effacée) pour la re-regarder à
 * neuf. Si elle est seulement commencée (pas 100%), on NE touche à RIEN → la
 * reprise reste où elle en est. Vaut pour une série (toute la série) comme un
 * film.
 */
export async function resetWatchedIfFullyWatchedOnAdd(
  qc: QueryClient,
  client: Fetcher,
  userId: string | null | undefined,
  targetId: string | undefined,
  seriesId: string | undefined,
): Promise<void> {
  if (!targetId || !userId) return;

  let fullyWatched: boolean;
  if (seriesId) {
    // Absent du cache (ajout depuis une carte, sans fiche) : on va le chercher.
    const state = qc.getQueryData<NextEpisodeResult>(seriesWatchStateKey(seriesId))
      ?? (await freshSeriesWatchState(qc, client, userId, seriesId));
    fullyWatched = state?.type === "completed";
  } else {
    let played = qc.getQueryData<MediaItem>(["item", targetId])?.UserData?.Played;
    if (played === undefined) {
      const fresh = await client
        .fetch(`/Users/${userId}/Items/${targetId}?EnableUserData=true`)
        .then((r) => r as MediaItem)
        .catch(() => null);
      played = fresh?.UserData?.Played;
    }
    fullyWatched = played === true;
  }
  if (!fullyWatched) return;

  await client
    .fetch(`/Users/${userId}/PlayedItems/${targetId}`, { method: "DELETE" })
    .catch(() => {});
  updateItemUserDataInCache(
    qc,
    seriesId ? { matchSeriesId: seriesId } : targetId,
    () => ({ Played: false, PlayedPercentage: 0 }),
  );
  if (seriesId) qc.invalidateQueries({ queryKey: seriesWatchStateKey(seriesId) });
}
