import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { deleteDownload, type DownloadEntry } from "../api";
import { setLocalWatched } from "../playbackApi";
import { DOWNLOAD_STATE_QUERY_KEY, DOWNLOADS_LIST_QUERY_KEY } from "../useDownloadState";
import { drainReportQueue } from "../../offline/resync";
import { useOfflineMode } from "../../offline/useOfflineMode";

/**
 * La coche « vu » des fiches locales, pour un titre ou une série entière.
 *
 * La base locale d'abord — c'est elle que lisent le catalogue et la fiche. En
 * ligne, le serveur l'apprend dans la foulée : « vu » par la file de
 * resynchronisation, vidée ici même (date réelle comprise), « non vu » par
 * Jellyfin directement, la file n'en portant jamais. Hors ligne, même à la
 * main alors que le serveur répond, rien ne part : la file attend le retour.
 */
export function useOfflineWatchedToggle(): (itemIds: readonly string[], played: boolean) => Promise<void> {
  const userId = useUserId();
  const offline = useOfflineMode();
  const client = useJellyfinClient();
  const queryClient = useQueryClient();

  return useCallback(async (itemIds, played) => {
    if (!userId) return;
    for (const itemId of itemIds) await setLocalWatched(userId, itemId, played);
    if (!offline) {
      if (played) {
        await drainReportQueue(userId);
      } else {
        await Promise.allSettled(
          itemIds.map((itemId) => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" })),
        );
      }
      for (const itemId of itemIds) void queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    }
    // La progression locale n'émet aucun évènement du moteur : on relit.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [DOWNLOADS_LIST_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [DOWNLOAD_STATE_QUERY_KEY] }),
    ]);
  }, [userId, offline, client, queryClient]);
}

/**
 * Retire des titres de CETTE machine, pour ce compte : le fichier ne part du
 * disque qu'avec le dernier compte qui le garde (déduplication du moteur). Le
 * moteur annonce le changement lui-même, les listes se relisent seules.
 */
export function useRemoveFromDevice(): (entries: readonly DownloadEntry[]) => Promise<void> {
  const userId = useUserId();
  return useCallback(async (entries) => {
    if (!userId) return;
    for (const entry of entries) await deleteDownload(userId, entry.id);
  }, [userId]);
}
