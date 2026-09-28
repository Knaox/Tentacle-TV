import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TitleKey, TitleMediaType } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";
import { hasRatingsSession } from "./useRatings";
import { WATCHLIST_SERIES_IDS_KEY } from "./watchlistEffects";

/**
 * « Ma liste à l'arrivée » : un titre hors bibliothèque mis de côté entre dans
 * « Ma liste » dès qu'il arrive (le serveur pose le like, cf.
 * services/watchlistPending.ts). Une seule liste par compte, un seul cache ;
 * chaque carte n'y lit que SA clé (`select`), et un geste ne re-rend qu'elle.
 */

export const WATCHLIST_PENDING_KEY = ["watchlist-pending"] as const;

type PendingList = TitleKey[];

function fetchPending(): Promise<PendingList> {
  return tentacleApiFetch<PendingList>("/api/watchlist/pending");
}

/** Le titre attend-il son arrivée pour entrer dans Ma liste ? */
export function useIsWatchlistPending(key: TitleKey | null, options?: { enabled?: boolean }): boolean {
  const { data } = useQuery({
    queryKey: WATCHLIST_PENDING_KEY,
    queryFn: fetchPending,
    staleTime: 60_000,
    enabled: hasRatingsSession() && key !== null && (options?.enabled ?? true),
    select: (list: PendingList) => (key !== null && list.includes(key)),
  });
  return data === true;
}

interface TmdbTitle {
  mediaType: TitleMediaType;
  tmdbId: number;
}

function keyOf(title: TmdbTitle): TitleKey {
  return `${title.mediaType}:${title.tmdbId}`;
}

/**
 * Mettre un titre dans Ma liste, ou l'en retirer, par son identité TMDB — sans
 * item Jellyfin sous la main. Déjà dans la bibliothèque, il y entre tout de
 * suite (`listed`) ; sinon il est mis de côté (`pending`). Écriture optimiste
 * dans la liste des titres mis de côté.
 */
export function useWatchlistByTmdb() {
  const qc = useQueryClient();

  const patch = async (key: TitleKey, present: boolean) => {
    await qc.cancelQueries({ queryKey: WATCHLIST_PENDING_KEY });
    const previous = qc.getQueryData<PendingList>(WATCHLIST_PENDING_KEY);
    qc.setQueryData<PendingList>(WATCHLIST_PENDING_KEY, (old) => {
      const rest = (old ?? []).filter((k) => k !== key);
      return present ? [key, ...rest] : rest;
    });
    return { previous };
  };
  const restore = (ctx: { previous?: PendingList } | undefined) => {
    if (ctx) qc.setQueryData(WATCHLIST_PENDING_KEY, ctx.previous);
  };
  // Un titre de la bibliothèque a changé de liste : Ma liste et ses Sets se relisent.
  const listChanged = () => {
    void qc.invalidateQueries({ queryKey: ["watchlist"] });
    void qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });
  };

  const add = useMutation({
    mutationFn: (title: TmdbTitle) =>
      tentacleApiFetch<{ state: "listed" | "pending"; itemId?: string }>("/api/watchlist/tmdb", {
        method: "PUT",
        body: JSON.stringify(title),
      }),
    onMutate: (title) => patch(keyOf(title), true),
    onError: (_err, _title, ctx) => restore(ctx),
    onSuccess: (res, title) => {
      if (res.state !== "listed") return;
      // Il était déjà là : pas de mise de côté, il est dans Ma liste.
      qc.setQueryData<PendingList>(WATCHLIST_PENDING_KEY, (old) => (old ?? []).filter((k) => k !== keyOf(title)));
      listChanged();
    },
  });

  const remove = useMutation({
    mutationFn: (title: TmdbTitle) =>
      tentacleApiFetch<{ state: "none" }>(`/api/watchlist/tmdb/${title.mediaType}/${title.tmdbId}`, { method: "DELETE" }),
    onMutate: (title) => patch(keyOf(title), false),
    onError: (_err, _title, ctx) => restore(ctx),
    onSuccess: listChanged,
  });

  return { add, remove };
}
