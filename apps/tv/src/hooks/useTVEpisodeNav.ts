import { useCallback, useMemo, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEpisodeNavigation } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { RootStackParamList } from "../navigation/types";

/**
 * Navigation inter-épisodes du lecteur téléviseur : aller à un épisode, et
 * les handlers de transport liés (précédent / suivant / play-pause).
 *
 * Le MOTEUR d'enchaînement n'est plus ici : segments, décomptes et surfaces
 * sont tranchés par l'arbitre partagé, monté par l'écran
 * (`useTVPlaybackOverlay`). Ce qui restait — la navigation elle-même — tient
 * en trois rappels, et son piège est intact : le dispatch DIFFÉRÉ d'un tick.
 */
export function useTVEpisodeNav(args: {
  item: MediaItem | undefined;
  reportStop: () => void;
  queryClient: QueryClient;
  itemId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "Player">;
  handleSeek: (seconds: number) => void;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { item, reportStop, queryClient, itemId, navigation, handleSeek, setPaused } = args;

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

  const { nextEpisode, previousEpisode } = useEpisodeNavigation(item);

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
    if (nextEpisode) navigateToEpisode(nextEpisode.Id);
  }, [nextEpisode, navigateToEpisode]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), [setPaused]);

  return useMemo(() => ({
    previousEpisode,
    navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause,
  }), [previousEpisode, navigateToEpisode, handlePrevEpisode, handleNextEpisode, handlePlayPause]);
}
