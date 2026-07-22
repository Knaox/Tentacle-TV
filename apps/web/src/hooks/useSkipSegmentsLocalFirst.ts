import { useIntroSkipper, type SkipSegments } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useLocalSkipSegments } from "./useLocalSkipSegments";

/**
 * Segments « passer l'intro / générique », LOCAL D'ABORD : en lecture locale
 * ils viennent du snapshot disque (zéro réseau, fonctionne hors ligne) ; en
 * streaming, les trois requêtes serveur historiques (useIntroSkipper).
 */
export function useSkipSegmentsLocalFirst(
  itemId: string | undefined,
  item: MediaItem | undefined,
  isLocalPlayback: boolean,
): SkipSegments {
  const server = useIntroSkipper(itemId, item, { enabled: !isLocalPlayback });
  const local = useLocalSkipSegments(itemId, item, isLocalPlayback);
  return isLocalPlayback ? local : server;
}
