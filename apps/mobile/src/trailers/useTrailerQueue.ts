import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch, useTrailerCatalog } from "@tentacle-tv/api-client";
import {
  readTrailerCatalog, trailerCatalogPath, trailerPlaybackKey, trailerQueueOf, type TrailerCatalogResponse, type TrailerQueueItem,
} from "@tentacle-tv/shared";
import type { TrailerRoute } from "./trailerRoute";

export interface TrailerQueueState {
  /** `loading` : la liste n'est pas encore venue ; `empty` : rien à lire. */
  status: "loading" | "ready" | "empty";
  queue: TrailerQueueItem[];
  /** L'index de départ : la bande-annonce touchée si la liste l'a, sinon la première. */
  start: number;
  /** La langue du serveur qui a décidé des versions (libellés VF / VOSTFR / VO), `null` hors catalogue. */
  language: string | null;
}

const NOTHING: TrailerQueueItem[] = [];

/** Le catalogue d'un titre TMDB (carte de Vigie) : la même liste, hors bibliothèque. */
function useTmdbCatalog(route: TrailerRoute | null, lang: string | undefined) {
  const target = route?.target.kind === "tmdb" ? route.target : null;
  return useQuery({
    queryKey: ["trailer-catalog-tmdb", target?.tmdbId ?? null, target?.mediaType ?? null, target?.season ?? null, lang ?? null],
    queryFn: async (): Promise<TrailerCatalogResponse | null> => {
      if (!target) return null;
      const path = trailerCatalogPath({ tmdbId: target.tmdbId, mediaType: target.mediaType, season: target.season, lang });
      return path ? readTrailerCatalog(await tentacleApiFetch<unknown>(path)) : null;
    },
    enabled: !!target,
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

/**
 * La file de l'écran des bandes-annonces, d'après sa route : le catalogue du
 * titre (la MÊME requête que la fiche, déjà en cache sous la même langue), ou
 * la seule vidéo YouTube demandée. Les bandes-annonces LOCALES n'y entrent
 * pas : elles se lisent dans le lecteur de l'app (`/watch`).
 */
export function useTrailerQueue(route: TrailerRoute | null, lang: string | undefined): TrailerQueueState {
  const item = route?.target.kind === "item" ? { Id: route.target.itemId, Type: route.target.itemType } : undefined;
  const library = useTrailerCatalog(item, lang, { enabled: !!item });
  const tmdb = useTmdbCatalog(route, lang);

  return useMemo(() => {
    if (!route) return { status: "empty", queue: NOTHING, start: 0, language: null };
    const { target } = route;
    if (target.kind === "youtube") {
      const queue: TrailerQueueItem[] = [{ playback: { kind: "youtube", ytId: target.ytId }, name: target.name ?? "" }];
      return { status: "ready", queue, start: 0, language: null };
    }
    const catalog = target.kind === "item" ? library.catalog : tmdb.data;
    const failed = target.kind === "item" ? library.settled && !catalog : tmdb.isError || (tmdb.isSuccess && !catalog);
    if (catalog === undefined && !failed) return { status: "loading", queue: NOTHING, start: 0, language: null };
    const queue = catalog ? trailerQueueOf(catalog.entries) : NOTHING;
    if (queue.length === 0) {
      // Une réponse incomplète peut encore s'enrichir : on attend sa relecture.
      const waiting = target.kind === "item" ? !library.settled : tmdb.isFetching;
      return { status: waiting ? "loading" : "empty", queue: NOTHING, start: 0, language: catalog?.language ?? null };
    }
    const wanted = route.start ? queue.findIndex((entry) => trailerPlaybackKey(entry.playback) === route.start) : -1;
    return { status: "ready", queue, start: Math.max(0, wanted), language: catalog?.language ?? null };
  }, [route, library.catalog, library.settled, tmdb.data, tmdb.isError, tmdb.isSuccess, tmdb.isFetching]);
}
