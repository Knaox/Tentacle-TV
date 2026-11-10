import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, type CacheTarget } from "./cacheUtils";
import { fetchMediaItem } from "./useLibrary";
import {
  beginUserDataGesture, failUserDataGesture, settleUserDataGesture, type UserDataGestureContext,
} from "./userDataGesture";

/**
 * Ce que les plateformes lisent sur la mutation (leur cache de mutations) :
 * le titre de l'échec à dire, et `userDataGesture` — le bureau y reconnaît un
 * « vu » posé à la main pour le reporter sur les titres gardés hors ligne.
 */
export const WATCHED_GESTURE_META = { failureTitle: "errors:toastWatchedFailed", userDataGesture: "watched" } as const;

interface WatchedToggleContext {
  /** Présent UNIQUEMENT quand l'item est un ÉPISODE → id de la série parente. */
  seriesId?: string;
  seasonId?: string;
  /**
   * Type de l'item ("Movie" | "Series" | "Episode") : une SÉRIE étend le patch
   * de cache à tous ses épisodes (cf. `target`).
   */
  itemType?: string;
}

/**
 * Marquer vu / non vu, À LA MAIN.
 *
 * « Ma liste » n'est PAS touchée : cocher « vu » est un geste de rangement, pas
 * un visionnage. Seule une lecture menée jusqu'au bout retire un titre de Ma
 * liste — voir `useWatchStopInvalidation` et `watchlistEffects`.
 */
export function useWatchedToggle(itemId: string | undefined, context?: WatchedToggleContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = context?.seriesId
    ? { seriesId: context.seriesId, seasonId: context.seasonId }
    : undefined;

  /**
   * Cible du patch optimiste. Sur une SÉRIE, elle englobe ses épisodes : c'est
   * ce que fait le serveur (`/PlayedItems/{seriesId}` marque toute la série), et
   * le cache doit dire la même chose. Sans ça, la vignette « +N nouveaux
   * épisodes » des derniers ajouts — dont l'état se déduit des épisodes groupés
   * (cf. `groupLatestByRuns`) — restait sur l'ancienne valeur jusqu'au refetch.
   */
  const target: CacheTarget =
    context?.itemType === "Series" && itemId ? { matchId: itemId, matchSeriesId: itemId } : itemId!;

  // Le geste répond avant le serveur, sur tout écran qui montre le titre (`userDataGesture`).
  const settle = (context: UserDataGestureContext | undefined) => {
    invalidateAllMediaQueries(qc, { itemId, seriesContext });
    void settleUserDataGesture(qc, context, { itemId, fetchItem: (id) => fetchMediaItem(client, userId, id) });
  };

  const markWatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "POST" }),
    // Un échec se DIT (la plateforme écoute son cache de mutations) : le geste est déjà défait.
    meta: WATCHED_GESTURE_META,
    onMutate: () => beginUserDataGesture(qc, { itemId, target, patch: { Played: true, PlayedPercentage: 100 } }),
    onError: (_err, _vars, ctx) => failUserDataGesture(qc, ctx),
    onSettled: (_data, error, _vars, ctx) => settle(error ? undefined : ctx),
  });

  const markUnwatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" }),
    meta: WATCHED_GESTURE_META,
    onMutate: () => beginUserDataGesture(qc, { itemId, target, patch: { Played: false, PlayedPercentage: 0 } }),
    onError: (_err, _vars, ctx) => failUserDataGesture(qc, ctx),
    onSettled: (_data, error, _vars, ctx) => settle(error ? undefined : ctx),
  });

  return { markWatched, markUnwatched };
}
