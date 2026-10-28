/**
 * Octave — le mode ne s'offre QUE si le serveur déclare `music.library` ET que
 * `/api/music/status` dit une bibliothèque musique visible par ce compte
 * (`useMusicStatus`, A3). Serveur d'avant, compte sans musique, hors ligne :
 * aucune entrée, aucune requête de plus.
 *
 * « Accès à Octave » (`octave.rights`, droit Tentacle) : le serveur le tient —
 * sans lui, le statut dit `available: false` et `octaveAccess: false` ; ni
 * bascule, ni réglage de démarrage, et un démarrage réglé sur Octave ouvre
 * Tentacle sans erreur (`OctaveHomeGate`). Un serveur d'avant ne dit rien :
 * Octave comme avant.
 */

import { useServerCapabilities } from "../hooks/useServerCapabilities";
import { useUserId } from "../hooks/useUserId";
import { useMusicStatus } from "./useMusicLibrary";

export interface OctaveAvailability {
  available: boolean;
  /** La réponse est connue (capacité absente, ou statut reçu) : l'absence est un fait. */
  settled: boolean;
}

export interface OctaveAvailabilityInput {
  enabled: boolean;
  userId: string | null;
  /** Ce que le serveur DÉCLARE (`/api/config` → `capabilities`) ; un serveur qui ne déclare rien : vide. */
  capabilities: ReadonlySet<string>;
  capsSettled: boolean;
  status: { data?: { available?: boolean; octaveAccess?: boolean } | undefined; isPending: boolean; isError: boolean };
}

/**
 * La règle, PURE : Octave n'existe que si le serveur déclare `music.library`
 * (capacité `since` 1.40.0 — jamais une comparaison de version) ET que ce
 * compte a une bibliothèque musique et le droit « Accès à Octave ». Un serveur
 * qui ne déclare rien : indisponible, et c'est un fait (aucune attente, aucune
 * requête de statut, aucune erreur).
 */
export function octaveAvailabilityOf({ enabled, userId, capabilities, capsSettled, status }: OctaveAvailabilityInput): OctaveAvailability {
  if (!enabled || !userId) return { available: false, settled: true };
  if (!capabilities.has("music.library")) return { available: false, settled: capsSettled };
  const permitted = status.data?.octaveAccess !== false;
  return { available: permitted && status.data?.available === true, settled: !status.isPending || status.isError };
}

export function useOctaveAvailability(enabled = true): OctaveAvailability {
  const { capabilities, settled: capsSettled } = useServerCapabilities();
  const userId = useUserId();
  const status = useMusicStatus();
  return octaveAvailabilityOf({ enabled, userId, capabilities, capsSettled, status });
}
