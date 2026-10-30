/**
 * Octave (mobile) — les FAITS que la règle du mode lit (`octaveStay.ts`, shared) : ce que le serveur dit
 * d'Octave, s'il a vraiment répondu (`/api/config` connu), le hors ligne, et le miroir du lancement. Une seule
 * lecture pour la porte d'Octave, la bascule de l'en-tête de Tentacle et l'entrée « Votre musique sur cet appareil ».
 */

import { useMusicStatus, useOctaveAvailability, useServerCapabilities } from "@tentacle-tv/api-client";
import type { OctaveModeFacts } from "@tentacle-tv/shared/octave/mode";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { mirrorAvailableNow } from "./octaveMirror";

export function useOctaveModeFacts(): OctaveModeFacts {
  const fresh = useOctaveAvailability();
  const failed = useMusicStatus().isError;
  const configKnown = useServerCapabilities().known;
  const offline = useOfflineMode();
  // Lu à chaque rendu (stockage déjà en mémoire) : il n'est écrit que d'une réponse établie.
  const mirrorAvailable = mirrorAvailableNow();
  return { fresh, failed, configKnown, offline, mirrorAvailable };
}
