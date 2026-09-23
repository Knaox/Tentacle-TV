import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEpisodes,
  useSeasonEpisodesLite,
  useJellyfinClient,
  useUserId,
  prefetchSeasons,
  prefetchSeasonEpisodesLite,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les épisodes d'une saison pour une liste du téléviseur : la version LÉGÈRE
 * d'abord, la complète dès qu'elle répond.
 *
 * Rien ne disparaît de l'écran. Les pastilles de qualité et de langues lisent
 * les sources de chaque fichier, que seule la version complète porte : elles
 * arrivent avec elle, une demi-seconde plus tard sur une longue saison. La
 * liste, elle, n'attend plus que le serveur ait calculé ces sources — c'est ce
 * calcul, et non le transfert ni l'analyse du JSON (19 ms pour 2,7 Mo sur
 * l'Apple TV), qui tenait le panneau vide.
 */
export function useSeasonEpisodes(
  seriesId: string | undefined,
  seasonId: string | undefined,
): MediaItem[] | undefined {
  const lite = useSeasonEpisodesLite(seriesId, seasonId);
  const full = useEpisodes(seriesId, seasonId);
  return full.data ?? lite.data;
}

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
