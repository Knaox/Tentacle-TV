/**
 * La saga TMDB d'un film, pour la rangée de sa fiche :
 *
 * 1. `GET /api/sagas/:collectionId` — le nom, les volets, et les films de la
 *    bibliothèque que le compte voit (identifiants seuls) ;
 * 2. ces films relus chez Jellyfin, avec l'état « vu » du compte : une liste
 *    plate sous le préfixe `saga-items`, que les bascules « vu » patchent en
 *    cache comme les autres rangées (`cacheUtils.ts`) ;
 * 3. `buildSagaView` (shared) les range, avec les volets manquants que la
 *    plateforme a obtenus des plugins (`useExternalCollection`).
 *
 * Aucune requête pour un film sans saga — la plupart. Compatible react-query
 * v4 (la TV) : queryKey, queryFn, enabled, staleTime, retry, retryDelay.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildSagaView, sagaCollectionIdOf,
  type ExternalSearchItem, type MediaItem, type SagaInfo, type SagaMember, type SagaResponse, type SagaView,
} from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { tentacleApiFetch } from "./usePreferences";

export const SAGA_KEY = "saga";
export const SAGA_ITEMS_KEY = "saga-items";

/** Une saga bouge peu ; l'état « vu » de ses films, lui, suit les bascules. */
const SAGA_STALE_MS = 10 * 60_000;
const ITEMS_STALE_MS = 5 * 60_000;
const ITEM_FIELDS = "Overview,PrimaryImageAspectRatio,ProviderIds,ParentId,MediaSources";

/** La réponse du serveur, relue champ par champ : illisible, la rangée se tait. */
export function readSagaResponse(raw: unknown, collectionId: number): SagaResponse | null {
  const body = raw as { saga?: unknown; members?: unknown } | null;
  if (!body || !Array.isArray(body.members)) return null;
  const members: SagaMember[] = [];
  for (const entry of body.members) {
    const m = entry as { itemId?: unknown; tmdbId?: unknown } | null;
    if (typeof m?.itemId !== "string" || !/^[0-9a-fA-F-]{32,36}$/.test(m.itemId)) continue;
    members.push({ itemId: m.itemId, tmdbId: typeof m.tmdbId === "number" && m.tmdbId > 0 ? m.tmdbId : null });
  }
  const s = body.saga as { name?: unknown; parts?: unknown } | null | undefined;
  const saga: SagaInfo | null = s && typeof s.name === "string" && Array.isArray(s.parts)
    ? {
        collectionId,
        name: s.name,
        parts: (s.parts as Array<{ tmdbId?: unknown; title?: unknown; releaseDate?: unknown }>)
          .filter((p) => typeof p?.tmdbId === "number" && typeof p.title === "string")
          .map((p) => ({
            tmdbId: p.tmdbId as number,
            title: p.title as string,
            releaseDate: typeof p.releaseDate === "string" ? p.releaseDate : null,
          })),
      }
    : null;
  return { collectionId, saga, members };
}

/** 503 : l'index du serveur se construit (son démarrage) — on réessaie, sans conclure. */
function retryWhileIndexing(failureCount: number, error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 503 && failureCount < 4;
}

export function useSagaResponse(collectionId: number | null, lang: string) {
  return useQuery({
    queryKey: [SAGA_KEY, collectionId ?? 0, lang],
    queryFn: async () =>
      readSagaResponse(await tentacleApiFetch<unknown>(`/api/sagas/${collectionId}?lang=${encodeURIComponent(lang)}`), collectionId ?? 0),
    enabled: collectionId !== null,
    staleTime: SAGA_STALE_MS,
    retry: retryWhileIndexing,
    retryDelay: 8_000,
  });
}

/** Les films de la saga relus chez Jellyfin, au nom du compte (l'état « vu » compris). */
export function useSagaItems(collectionId: number | null, members: readonly SagaMember[] | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const ids = useMemo(() => (members ?? []).map((m) => m.itemId).sort().join(","), [members]);
  return useQuery({
    queryKey: [SAGA_ITEMS_KEY, collectionId ?? 0, ids],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Ids=${ids}&Fields=${ITEM_FIELDS}` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`,
        )
        .then((r) => r.Items),
    enabled: !!userId && collectionId !== null && ids !== "",
    staleTime: ITEMS_STALE_MS,
  });
}

export interface SagaViewOptions {
  /** Langue de l'interface (deux lettres) : le nom de la saga suit. */
  lang: string;
  /** Les volets manquants, par plugin — absents sur les téléviseurs. */
  external?: ReadonlyArray<{ pluginId: string; items: readonly ExternalSearchItem[] }>;
}

export interface SagaViewState {
  /** null tant que rien n'est lu, et pour un film sans saga (ou seul de sa saga). */
  view: SagaView | null;
  collectionId: number | null;
}

const NO_EXTERNAL: NonNullable<SagaViewOptions["external"]> = [];

export function useSagaView(item: MediaItem | undefined, { lang, external = NO_EXTERNAL }: SagaViewOptions): SagaViewState {
  const collectionId = sagaCollectionIdOf(item);
  const { data: response } = useSagaResponse(collectionId, lang);
  const { data: items } = useSagaItems(collectionId, response?.members);
  const currentId = item?.Id;
  const view = useMemo(() => {
    // La rangée attend les deux lectures : sans les films, le film ouvert n'y
    // serait pas encore — elle naîtrait sans lui, puis sauterait.
    if (!currentId || !response || !items) return null;
    return buildSagaView({ response, items, external, currentId });
  }, [currentId, response, items, external]);
  return { view, collectionId };
}
