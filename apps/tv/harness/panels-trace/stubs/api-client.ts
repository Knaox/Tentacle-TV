import { note } from "./record";

/**
 * Une doublure de @tentacle-tv/api-client : chaque crochet lit l'état que le
 * scénario pose (`api`) au rendu ; chaque écriture est notée, jamais envoyée.
 */

type Item = Record<string, unknown> & { Id: string };

export const api: Record<string, unknown> = {};
(globalThis as unknown as { __api: typeof api }).__api = api;

export function resetApi(state: Record<string, unknown> = {}): void {
  for (const key of Object.keys(api)) delete api[key];
  Object.assign(api, state);
}

const mutation = (name: string) => ({
  mutate: (value: unknown) => note({ [name]: value }),
  mutateAsync: async (value: unknown) => {
    note({ [name]: value });
    return { kind: "done", ok: true, message: null, state: null };
  },
});

export const useRecoSettings = () => ({ data: api.recoSettings });
export const useMediaItem = (id?: string) => ({ data: id ? (api.fullItem as Item | undefined) : undefined, isLoading: id ? api.fullLoading === true : false });
export const recoMarkerItem = (item: { key: string; title: string }) => ({ Id: `reco:${item.key}`, Name: item.title, Type: "Movie" });
export const useCardToggles = () => ({
  states: (api.toggles as Record<string, boolean>) ?? { watchlist: false, favorite: false, watched: false },
  toggle: (kind: string) => note({ toggle: kind }),
});
export const useCardRatingTarget = (face: Item | null) => ({
  identity: (api.ratingIdentity as object | null) ?? null,
  pending: api.ratingPending === true,
  jellyfinItemId: face?.Id ?? null,
});
export const ratingKey = (identity: { tmdbId?: number; mediaType?: string }) => `${identity.mediaType}:${identity.tmdbId}`;
export const useMyRatings = () => ({ data: api.ratings as unknown[] | undefined });
export const useRateItem = () => mutation("rate");
export const useDeleteRating = () => mutation("removeRating");
export const useResolvePlayTarget = () => async () => (api.resolvePlay as string | null) ?? null;
export const useSendRecoFeedback = () => mutation("feedback");
export const useSaveRecoProviderFilter = () => mutation("providerFilter");
export const useSeriesWatchState = (id?: string) => ({ data: id ? api.seriesWatch : undefined });
export const useJellyfinClient = () => ({ getImageUrl: (id: string, type: string) => `img:${id}:${type}` });
export const useTentacleConfig = () => ({ storage: { getItem: () => null } });
export const useRecoCardHold = () => {};
export const useMyTitles = () => ({ titles: (api.myTitles as unknown[]) ?? [], updatedAt: 0 });
export const titleStateQueryKey = (provider: { pluginId?: string } | null, lang: string, key: string | null) =>
  ["title-state", provider?.pluginId ?? "", lang, key ?? ""] as const;
/** La lecture de l'état d'un titre : notée avec ce qu'elle demande, puis passée au `fetcher` de l'appelant. */
export const loadTitleState = async (provider: { pluginId?: string }, key: string, lang: string, fetcher: (url: string) => Promise<unknown>) => {
  note({ loadTitleState: { provider: provider.pluginId ?? null, key, lang } });
  return fetcher("/bench/titles/state");
};
export const tentacleApiFetch = async (url: string) => {
  note({ fetch: url });
  return (api.query as { data?: unknown } | undefined)?.data ?? null;
};
export const useRequestTitleSeasons = () => mutation("requestSeasons");
export const useSeasons = (seriesId?: string) => ({ data: seriesId ? api.librarySeasons : undefined, isError: false });
export const useTitleSeasons = () => ({ answer: api.seasonsAnswer ?? null, failed: api.seasonsFailed === true });
