import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveSeasonSelection, type MediaItem } from "@tentacle-tv/shared";
import { useSeasons } from "./useSeasons";
import { useSeriesWatchState } from "./useWatchState";
import { useUserId } from "./useUserId";
import { useAdjacentSeasonsPrefetch, usePrefetchSeasonEpisodes, useSeasonEpisodeList } from "./useSeasonEpisodeList";

export interface SeasonBrowserOptions {
  seriesId: string | undefined;
  /** Saison imposée : celle de l'épisode ouvert, ou de l'épisode en lecture. */
  preferredSeasonId?: string;
  /**
   * La liste suit l'état de visionnage de la série (fiche d'une SÉRIE) : elle
   * s'ouvre sur la saison de l'épisode à reprendre, et attend cet état plutôt
   * que d'afficher une saison qui changerait sous les yeux.
   */
  followResume?: boolean;
  /** L'épisode mis en avant (reprise, épisode ouvert) : sa saison est marquée. */
  currentEpisodeSeasonId?: string;
  /** Charger les sources (pastilles de qualité, téléchargement). Vrai par défaut. */
  sources?: boolean;
  /**
   * Montrer la saison pressentie pendant l'attente de l'état de visionnage
   * (vrai par défaut). Le téléviseur passe `false` : une liste qui changerait
   * sous le focus de la télécommande le perdrait.
   */
  provisional?: boolean;
}

export interface SeasonBrowser {
  seasons: MediaItem[] | undefined;
  seasonsLoading: boolean;
  /** La saison affichée — indéfinie pendant l'attente si `provisional` est faux. */
  selectedSeasonId: string | undefined;
  /** La saison marquée « en cours » dans la bande. */
  markedSeasonId: string | undefined;
  select: (seasonId: string) => void;
  /** Précharger une saison (survol, focus d'une pastille). */
  prefetch: (seasonId: string) => void;
  episodes: MediaItem[] | undefined;
  withSources: MediaItem[] | undefined;
  episodesLoading: boolean;
}

/**
 * Tout le parcours d'une liste de saisons, une fois pour toutes les
 * plateformes — seule l'ENTRÉE diffère (souris, doigt, télécommande).
 *
 * - La saison d'ouverture suit `resolveSeasonSelection` : jamais « Spéciaux »
 *   par défaut ; la saison pressentie tout de suite, corrigée par l'état de
 *   visionnage s'il la dément (et tant que l'utilisateur n'a rien choisi). Sans
 *   provisoire, elle se précharge pendant l'attente.
 * - Le choix de l'utilisateur est rattaché à SA série : une fiche réutilisée
 *   pour une autre série ne garde pas une saison qui ne lui appartient pas.
 * - Liste légère d'abord, sources ensuite (`useSeasonEpisodeList`), et les
 *   saisons voisines préchargées au repos.
 *
 * Écrit sans `isPending` ni `isLoading` : leurs définitions changent entre
 * react-query 4 (téléviseur) et 5.
 */
export function useSeasonBrowser(options: SeasonBrowserOptions): SeasonBrowser {
  const { seriesId, preferredSeasonId, followResume = false, currentEpisodeSeasonId, sources = true, provisional = true } = options;
  const userId = useUserId();
  const { data: seasons, isError: seasonsFailed } = useSeasons(seriesId);
  const watch = useSeriesWatchState(followResume ? seriesId : undefined);
  const [choice, setChoice] = useState<{ seriesId: string; seasonId: string } | null>(null);

  const watchPending = followResume && !!seriesId && !!userId && watch.data === undefined && !watch.isError;
  const selection = useMemo(
    () => resolveSeasonSelection({ seasons, preferredSeasonId, watchState: watch.data, watchPending, provisional }),
    [seasons, preferredSeasonId, watch.data, watchPending, provisional],
  );
  const chosen = choice && choice.seriesId === seriesId && seasons?.some((s) => s.Id === choice.seasonId) ? choice.seasonId : undefined;
  const selectedSeasonId = chosen ?? selection.seasonId;
  const list = useSeasonEpisodeList(seriesId, selectedSeasonId, { sources });
  const prefetch = usePrefetchSeasonEpisodes(seriesId);

  // Sans provisoire affiché, l'attente ne coûte rien pour autant : la saison
  // pressentie part tout de suite.
  const awaited = !selectedSeasonId ? selection.provisionalSeasonId : undefined;
  useEffect(() => {
    if (awaited) prefetch(awaited);
  }, [awaited, prefetch]);
  useAdjacentSeasonsPrefetch(seriesId, seasons, selectedSeasonId, list.episodes !== undefined);

  const select = useCallback((seasonId: string) => {
    if (seriesId) setChoice({ seriesId, seasonId });
  }, [seriesId]);

  return {
    seasons,
    seasonsLoading: !!seriesId && seasons === undefined && !seasonsFailed,
    selectedSeasonId,
    markedSeasonId: selection.currentSeasonId ?? currentEpisodeSeasonId,
    select,
    prefetch,
    episodes: list.episodes,
    withSources: list.withSources,
    episodesLoading: list.isLoading || (!!seasons?.length && !selectedSeasonId),
  };
}
