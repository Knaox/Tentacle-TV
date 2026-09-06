import { useMemo } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { findAdjacentLocalEpisodes, type LocalEpisodeNavigation } from "@tentacle-tv/offline-core";
import { useOfflineList } from "./useOfflineList";

/**
 * Épisode précédent / suivant parmi les titres COMPLETS de l'appareil, de la
 * même série, à travers les saisons — jamais le serveur. Mêmes règles que le
 * bureau (logique pure du cœur).
 */
export function useLocalEpisodeNavigation(itemId: string | undefined): LocalEpisodeNavigation {
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  return useMemo(() => findAdjacentLocalEpisodes(data ?? [], itemId), [data, itemId]);
}
