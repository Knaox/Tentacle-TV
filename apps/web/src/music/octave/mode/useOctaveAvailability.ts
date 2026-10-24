/**
 * Octave — le mode ne s'offre QUE si le serveur déclare `music.library` ET que
 * `/api/music/status` dit une bibliothèque musique visible par ce compte.
 * Serveur d'avant, compte sans musique, hors ligne : aucune entrée, aucune
 * requête de plus (la configuration est déjà en cache).
 */

import { useQuery } from "@tanstack/react-query";
import { useServerCapabilities, useUserId } from "@tentacle-tv/api-client";
import { libraryApi } from "../data/libraryApi";

export const MUSIC_STATUS_KEY = "octave-status";

export interface OctaveAvailability {
  available: boolean;
  /** La réponse est connue (capacité absente, ou statut reçu) : l'absence est un fait. */
  settled: boolean;
}

export function useOctaveAvailability(enabled = true): OctaveAvailability {
  const { capabilities, settled: capsSettled } = useServerCapabilities();
  const userId = useUserId();
  const declared = capabilities.has("music.library");
  const status = useQuery({
    queryKey: [MUSIC_STATUS_KEY, userId],
    queryFn: libraryApi.status,
    enabled: enabled && declared && !!userId,
    staleTime: 60_000,
    retry: 1,
  });
  if (!enabled || !userId) return { available: false, settled: true };
  if (!declared) return { available: false, settled: capsSettled };
  return { available: status.data?.available === true, settled: !status.isPending };
}
