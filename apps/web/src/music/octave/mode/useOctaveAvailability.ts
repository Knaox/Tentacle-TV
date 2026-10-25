/**
 * Octave — le mode ne s'offre QUE si le serveur déclare `music.library` ET que
 * `/api/music/status` dit une bibliothèque musique visible par ce compte
 * (`useMusicStatus`, A3). Serveur d'avant, compte sans musique, hors ligne :
 * aucune entrée, aucune requête de plus.
 */

import { useMusicStatus, useServerCapabilities, useUserId } from "@tentacle-tv/api-client";

export interface OctaveAvailability {
  available: boolean;
  /** La réponse est connue (capacité absente, ou statut reçu) : l'absence est un fait. */
  settled: boolean;
}

export function useOctaveAvailability(enabled = true): OctaveAvailability {
  const { capabilities, settled: capsSettled } = useServerCapabilities();
  const userId = useUserId();
  const status = useMusicStatus();
  if (!enabled || !userId) return { available: false, settled: true };
  if (!capabilities.has("music.library")) return { available: false, settled: capsSettled };
  return { available: status.data?.available === true, settled: !status.isPending || status.isError };
}
