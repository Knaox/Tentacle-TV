import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries } from "./cacheUtils";
import {
  beginUserDataGesture, settleUserDataGesture, type UserDataGestureContext,
} from "./userDataGesture";
import { WATCHED_GESTURE_META } from "./useWatchedToggle";

interface BatchWatchedContext {
  seriesId: string;
  seasonId?: string;
}

const PLAYED = { Played: true, PlayedPercentage: 100 } as const;
const UNPLAYED = { Played: false, PlayedPercentage: 0 } as const;

/**
 * Marquer vus / non vus PLUSIEURS épisodes d'un coup (une saison entière).
 *
 * Le geste répond avant le serveur, comme une bascule seule : chaque épisode
 * est patché dans les caches et tenu (`userDataGesture`) — avant, la saison
 * attendait ses N requêtes puis le rechargement pour changer à l'écran. Les
 * requêtes partent ensemble et aucune n'arrête les autres (`allSettled`) : un
 * refus isolé est corrigé par le rechargement des listes de la série, qui dit
 * la vérité du serveur.
 */
export function useBatchWatchedToggle(ctx: BatchWatchedContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = { seriesId: ctx.seriesId, seasonId: ctx.seasonId };

  const begin = async (ids: string[], patch: typeof PLAYED | typeof UNPLAYED) => {
    const contexts: UserDataGestureContext[] = [];
    for (const id of ids) contexts.push(await beginUserDataGesture(qc, { itemId: id, target: id, patch }));
    return contexts;
  };

  // Batch (saison entière) : refetch immédiat des listes liées à la série
  // pour refléter l'état "tous les épisodes vus" sans attendre le prochain
  // focus — et les gestes ne sont relâchés qu'une fois ces listes revenues.
  const settle = (ids: string[], contexts: UserDataGestureContext[] | undefined) => {
    invalidateAllMediaQueries(qc, { seriesContext, refetchSeriesContext: true });
    const episodes = qc.invalidateQueries({ queryKey: ["episodes", ctx.seriesId], refetchType: "active" });
    (contexts ?? []).forEach((context, index) => {
      void settleUserDataGesture(qc, context, { itemId: ids[index], refetches: [episodes] });
    });
  };

  const markWatched = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/PlayedItems/${id}`, { method: "POST" })
        )
      ),
    meta: WATCHED_GESTURE_META,
    onMutate: (ids) => begin(ids, PLAYED),
    onSettled: (_data, _error, ids, contexts) => settle(ids, contexts),
  });

  const markUnwatched = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/PlayedItems/${id}`, { method: "DELETE" })
        )
      ),
    meta: WATCHED_GESTURE_META,
    onMutate: (ids) => begin(ids, UNPLAYED),
    onSettled: (_data, _error, ids, contexts) => settle(ids, contexts),
  });

  return { markWatched, markUnwatched };
}
