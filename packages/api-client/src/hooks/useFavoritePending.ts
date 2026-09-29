import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TitleKey, TitleMediaType } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";
import { hasRatingsSession } from "./useRatings";
import { FAVORITE_LIST_KEYS, FAVORITE_SERIES_IDS_KEY } from "./watchlistEffects";

/**
 * « J'aime » d'un titre hors bibliothèque : le cœur des autres cartes, pour
 * un titre qui n'est pas encore là. Le serveur en fait un like du catalogue —
 * le goût des recommandations le compte aussitôt — et pose le cœur à
 * l'arrivée (cf. routes/likesTmdb.ts). Une seule liste par compte, un seul
 * cache ; chaque carte n'y lit que SA clé (`select`), et un geste ne re-rend
 * qu'elle. Le cœur d'Affiner qui attend son titre s'y lit aussi.
 */

export const FAVORITE_PENDING_KEY = ["favorite-pending"] as const;

type PendingList = TitleKey[];

function fetchPending(): Promise<PendingList> {
  return tentacleApiFetch<PendingList>("/api/likes/pending");
}

const pendingQuery = { queryKey: FAVORITE_PENDING_KEY, queryFn: fetchPending, staleTime: 60_000, retry: 1 } as const;

/** Le titre est-il aimé, en attendant son arrivée ? */
export function useIsFavoritePending(key: TitleKey | null, options?: { enabled?: boolean }): boolean {
  const { data } = useQuery({
    ...pendingQuery,
    enabled: hasRatingsSession() && key !== null && (options?.enabled ?? true),
    select: (list: PendingList) => (key !== null && list.includes(key)),
  });
  return data === true;
}

/**
 * Le serveur sait-il aimer un titre absent ? Vrai dès que la liste est lue :
 * un serveur d'avant ces routes répond 404, et la carte n'offre alors pas de
 * cœur plutôt qu'un geste qui échouerait.
 */
export function useLikesAvailable(enabled = true): boolean {
  const { isSuccess } = useQuery({ ...pendingQuery, enabled: hasRatingsSession() && enabled, select: () => true });
  return isSuccess;
}

interface TmdbTitle {
  mediaType: TitleMediaType;
  tmdbId: number;
}

function keyOf(title: TmdbTitle): TitleKey {
  return `${title.mediaType}:${title.tmdbId}`;
}

/**
 * Aimer un titre, ou ne plus l'aimer, par son identité TMDB — sans item
 * Jellyfin sous la main. Déjà dans la bibliothèque, le cœur est posé tout de
 * suite (`favorited`) ; sinon il attend son arrivée (`pending`). Écriture
 * optimiste dans la liste des titres aimés.
 */
export function useFavoriteByTmdb() {
  const qc = useQueryClient();

  const patch = async (key: TitleKey, present: boolean) => {
    await qc.cancelQueries({ queryKey: FAVORITE_PENDING_KEY });
    const previous = qc.getQueryData<PendingList>(FAVORITE_PENDING_KEY);
    qc.setQueryData<PendingList>(FAVORITE_PENDING_KEY, (old) => {
      const rest = (old ?? []).filter((k) => k !== key);
      return present ? [key, ...rest] : rest;
    });
    return { previous };
  };
  const restore = (ctx: { previous?: PendingList } | undefined) => {
    if (ctx) qc.setQueryData(FAVORITE_PENDING_KEY, ctx.previous);
  };
  // Un titre de la bibliothèque a changé de cœur : les favoris et leurs Sets se relisent.
  const favoritesChanged = () => {
    for (const key of FAVORITE_LIST_KEYS) void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: FAVORITE_SERIES_IDS_KEY });
  };

  const add = useMutation({
    mutationFn: (title: TmdbTitle) =>
      tentacleApiFetch<{ state: "favorited" | "pending"; itemId?: string }>("/api/likes/tmdb", {
        method: "PUT",
        body: JSON.stringify(title),
      }),
    onMutate: (title) => patch(keyOf(title), true),
    onError: (_err, _title, ctx) => restore(ctx),
    onSuccess: (res, title) => {
      if (res.state !== "favorited") return;
      // Il était déjà là : le cœur est posé, rien n'attend son arrivée.
      qc.setQueryData<PendingList>(FAVORITE_PENDING_KEY, (old) => (old ?? []).filter((k) => k !== keyOf(title)));
      favoritesChanged();
    },
  });

  const remove = useMutation({
    mutationFn: (title: TmdbTitle) =>
      tentacleApiFetch<{ state: "none" }>(`/api/likes/tmdb/${title.mediaType}/${title.tmdbId}`, { method: "DELETE" }),
    onMutate: (title) => patch(keyOf(title), false),
    onError: (_err, _title, ctx) => restore(ctx),
    onSuccess: favoritesChanged,
  });

  return { add, remove };
}
