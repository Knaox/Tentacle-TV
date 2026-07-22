import { useMediaItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useLocalMediaItem } from "./useLocalMediaItem";

/**
 * DTO de l'item, LOCAL D'ABORD : en lecture locale le snapshot disque remplace
 * la requête serveur (`enabled: false`) — zéro réseau, en ligne comme hors
 * ligne. Pendant la résolution locale (waitingLocal, quelques ms d'IPC), la
 * requête serveur ne part pas non plus : un item téléchargé ne doit jamais
 * déclencher de fetch furtif. En streaming (ou web), comportement historique.
 */
export function useLocalFirstMedia({
  itemId,
  isLocalPlayback,
  waitingLocal,
}: {
  itemId: string | undefined;
  isLocalPlayback: boolean;
  waitingLocal: boolean;
}): {
  item: MediaItem | undefined;
  isLoading: boolean;
} {
  const server = useMediaItem(itemId, { enabled: !waitingLocal && !isLocalPlayback });
  const localItem = useLocalMediaItem(itemId, isLocalPlayback);
  if (isLocalPlayback) return { item: localItem ?? undefined, isLoading: false };
  return { item: server.data, isLoading: waitingLocal || server.isLoading };
}
