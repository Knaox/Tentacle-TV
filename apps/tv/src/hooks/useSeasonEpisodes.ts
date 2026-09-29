import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId, prefetchSeasons, prefetchSeasonEpisodesLite } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Précharge ce que le panneau des épisodes affichera — les saisons, et la
 * saison de l'épisode lu — dès que la lecture a démarré.
 *
 * Après la première image et hors interaction : l'ouverture du flux passe
 * d'abord. Les deux requêtes sont légères (quelques centaines de kilo-octets
 * sur les plus longues saisons), et le panneau s'ouvre ensuite déjà rempli au
 * lieu d'attendre le réseau. Les sources, lourdes, ne sont PAS préchargées :
 * seule l'ouverture du panneau les demande.
 */
export function useEpisodePanelPrefetch(item: MediaItem | null | undefined, started: boolean) {
  const qc = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();
  const seriesId = item?.SeriesId ?? undefined;
  const seasonId = item?.SeasonId ?? undefined;

  useEffect(() => {
    if (!started || !seriesId || !seasonId) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void prefetchSeasons(qc, client, userId, seriesId);
      void prefetchSeasonEpisodesLite(qc, client, userId, seriesId, seasonId);
    });
    return () => task.cancel();
  }, [started, seriesId, seasonId, qc, client, userId]);
}
