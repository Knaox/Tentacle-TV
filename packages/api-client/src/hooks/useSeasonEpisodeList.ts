import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adjacentSeasonIds, type MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { prefetchSeasonEpisodesLite, useSeasonEpisodesLite } from "./useSeasons";

/**
 * La liste d'épisodes d'une saison telle qu'une fiche l'affiche : la version
 * LÉGÈRE d'abord, les SOURCES ensuite, fusionnées par identifiant.
 *
 * Avant, chaque liste demandait d'un coup `MediaSources` et `MediaStreams`,
 * que seules les pastilles de qualité et le téléchargement lisent : une saison
 * de 196 épisodes pesait 2,6 Mo et ne s'affichait qu'au bout de sa réponse la
 * plus lente. Les lignes arrivent maintenant avec la liste légère (0,3 Mo) ;
 * les pastilles suivent quand les sources répondent.
 *
 * Mêmes champs, même rendu final — seul l'ordre d'arrivée change.
 */

/** Le strict nécessaire d'un client Jellyfin, décrit par sa forme. */
interface ItemsFetchClient {
  fetch<T>(url: string): Promise<T>;
}

const SOURCES_STALE_TIME = 10 * 60 * 1000;

/**
 * La clé des sources d'une saison — HORS du préfixe `episodes`, exprès : une
 * bascule « vu » invalide toutes les listes d'épisodes, et les sources ne
 * changent pas quand on regarde. Rangées dessous, elles se redemandaient à
 * chaque coche.
 */
export const getSeasonEpisodeSourcesKey = (seriesId: string | undefined, seasonId: string | undefined) =>
  ["episode-sources", seriesId, seasonId] as const;

function fetchSeasonEpisodeSources(client: ItemsFetchClient, userId: string, seriesId: string, seasonId: string) {
  // Ni images ni `UserData` : la liste légère les porte déjà, et c'est elle
  // qui fait foi pour l'état « vu ».
  return client
    .fetch<{ Items: MediaItem[] }>(
      `/Shows/${seriesId}/Episodes?SeasonId=${seasonId}&userId=${userId}` +
        "&Fields=MediaSources&EnableImages=false&EnableUserData=false",
    )
    .then((r) => r.Items);
}

export interface SeasonEpisodeList {
  /** Les épisodes à afficher, sources comprises dès qu'elles sont là. */
  episodes: MediaItem[] | undefined;
  /** La même liste, mais seulement une fois les sources arrivées (téléchargement). */
  withSources: MediaItem[] | undefined;
  /** Rien à afficher encore pour une saison choisie. */
  isLoading: boolean;
  isError: boolean;
}

/** Les sources greffées sur la liste légère, par identifiant ; rien tant qu'il manque l'une des deux. */
export function mergeSeasonSources(lite: MediaItem[] | undefined, sources: MediaItem[] | undefined): MediaItem[] | undefined {
  if (!lite || !sources) return undefined;
  const byId = new Map(sources.map((ep) => [ep.Id, ep.MediaSources] as const));
  return lite.map((ep) => {
    const mediaSources = byId.get(ep.Id);
    return mediaSources ? { ...ep, MediaSources: mediaSources } : ep;
  });
}

export function useSeasonEpisodeList(
  seriesId: string | undefined,
  seasonId: string | undefined,
  options?: { sources?: boolean },
): SeasonEpisodeList {
  const client = useJellyfinClient();
  const userId = useUserId();
  const lite = useSeasonEpisodesLite(seriesId, seasonId);
  const wantSources = options?.sources ?? true;
  // Les sources partent APRÈS la liste légère : elles ne lui disputent pas le
  // serveur, et la liste s'affiche la première.
  const sources = useQuery({
    queryKey: getSeasonEpisodeSourcesKey(seriesId, seasonId),
    queryFn: () => fetchSeasonEpisodeSources(client, userId!, seriesId!, seasonId!),
    enabled: wantSources && !!userId && !!seriesId && !!seasonId && lite.data !== undefined,
    staleTime: SOURCES_STALE_TIME,
  });
  const withSources = useMemo(() => mergeSeasonSources(lite.data, sources.data), [lite.data, sources.data]);
  return {
    episodes: withSources ?? lite.data,
    withSources,
    // Écrit sans `isLoading` : sa définition change entre react-query 4 (TV)
    // et 5, et une requête désactivée compterait comme « en chargement » en 4.
    isLoading: !!seasonId && lite.data === undefined && !lite.isError,
    isError: lite.isError,
  };
}

type IdleHandle = { cancel: () => void };
type PrefetchClient = Parameters<typeof prefetchSeasonEpisodesLite>[0];

/** `requestIdleCallback` quand il existe (navigateurs, React Native), un délai sinon. */
function whenIdle(run: () => void): IdleHandle {
  const g = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  if (g.requestIdleCallback && g.cancelIdleCallback) {
    const handle = g.requestIdleCallback(run, { timeout: 1500 });
    return { cancel: () => g.cancelIdleCallback?.(handle) };
  }
  const timer = setTimeout(run, 250);
  return { cancel: () => clearTimeout(timer) };
}

/**
 * Précharger une saison (liste légère) : au survol ou au focus d'une pastille,
 * et pour la saison pressentie pendant qu'on attend l'état de visionnage.
 * Stable : passée en prop à des pastilles mémoïsées.
 */
export function usePrefetchSeasonEpisodes(seriesId: string | undefined): (seasonId: string) => void {
  const qc = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();
  return useCallback(
    (seasonId: string) => {
      // Le client de requêtes passe par sa forme (`prefetchQuery`), comme sur le
      // téléviseur où il est en version 4.
      if (seriesId) void prefetchSeasonEpisodesLite(qc as unknown as PrefetchClient, client, userId, seriesId, seasonId);
    },
    [qc, client, userId, seriesId],
  );
}

/**
 * Une fois la saison affichée prête, ses voisines se préchargent — la suivante
 * d'abord — quand le fil est libre : changer de saison devient immédiat, sans
 * jamais disputer le réseau à ce qu'on regarde. Liste légère seulement ; les
 * sources, lourdes, ne partent que pour la saison ouverte.
 */
export function useAdjacentSeasonsPrefetch(
  seriesId: string | undefined,
  seasons: readonly Pick<MediaItem, "Id">[] | undefined,
  seasonId: string | undefined,
  ready: boolean,
): void {
  const prefetch = usePrefetchSeasonEpisodes(seriesId);
  const neighbours = useMemo(() => adjacentSeasonIds(seasons, seasonId).join(","), [seasons, seasonId]);
  useEffect(() => {
    if (!ready || !neighbours) return;
    const idle = whenIdle(() => neighbours.split(",").forEach(prefetch));
    return idle.cancel;
  }, [ready, neighbours, prefetch]);
}
