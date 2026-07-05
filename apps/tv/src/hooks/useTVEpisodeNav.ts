import { useCallback, useMemo, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIntroSkipper, useEpisodeNavigation } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useAutoPlay } from "./useAutoPlay";
import type { RootStackParamList } from "../navigation/types";

/**
 * Navigation inter-épisodes du lecteur Apple TV : auto-play (générique →
 * épisode suivant), skip intro/crédits, et les handlers de transport liés
 * (précédent/suivant/play-pause). Enveloppe useAutoPlay + useEpisodeNavigation
 * + useIntroSkipper — extraits VERBATIM de PlayerScreen (ordre des hooks
 * préservé : useIntroSkipper → navigateToEpisode → useAutoPlay →
 * useEpisodeNavigation → handlers).
 */
export function useTVEpisodeNav(args: {
  item: MediaItem | undefined;
  jellyfinDuration?: number;
  reportStop: () => void;
  queryClient: QueryClient;
  itemId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "Player">;
  handleSeek: (seconds: number) => void;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    item, jellyfinDuration, reportStop, queryClient, itemId, navigation, handleSeek, setPaused,
  } = args;

  const skipSegments = useIntroSkipper(itemId, item);

  const navigateToEpisode = useCallback((episodeId: string) => {
    reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    // Différé d'un tick : usePreventRemove (panneau épisodes/écran de fin encore rendus
    // ouverts) bloque un dispatch du MÊME tick — la valeur de prévention vient du dernier
    // rendu. Sans ça, sélectionner un épisode dans le panneau exigeait DEUX appuis (le
    // replace était silencieusement annulé, seul le panneau se fermait).
    setTimeout(() => navigation.replace("Player", { itemId: episodeId }), 0);
  }, [reportStop, queryClient, itemId, navigation]);

  const autoPlay = useAutoPlay(item, jellyfinDuration ?? 0, navigateToEpisode);
  const { previousEpisode } = useEpisodeNavigation(item);

  const prevClickTimeRef = useRef(0);
  const handlePrevEpisode = useCallback(() => {
    const now = Date.now();
    if (now - prevClickTimeRef.current < 500 && previousEpisode) {
      navigateToEpisode(previousEpisode.Id);
    } else {
      handleSeek(0);
    }
    prevClickTimeRef.current = now;
  }, [previousEpisode, navigateToEpisode, handleSeek]);

  const handleNextEpisode = useCallback(() => {
    if (autoPlay.nextEpisode) navigateToEpisode(autoPlay.nextEpisode.Id);
  }, [autoPlay.nextEpisode, navigateToEpisode]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), [setPaused]);

  return useMemo(() => ({
    autoPlay, skipSegments, previousEpisode,
    navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause,
  }), [autoPlay, skipSegments, previousEpisode, navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause]);
}
