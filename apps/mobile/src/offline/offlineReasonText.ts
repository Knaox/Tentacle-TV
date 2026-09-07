import type { OfflineReason } from "./connectivityProbe";

/**
 * La clé (namespace `downloads`) qui dit POURQUOI l'application est hors ligne.
 *
 * Une seule formulation pour la bulle d'état et le bandeau de bascule : deux
 * textes qui divergent sur la même panne feraient douter de l'un des deux.
 */
export function offlineReasonKey(reason: OfflineReason): string {
  if (reason === "network") return "offlineReasonNetwork";
  if (reason === "jellyfin") return "offlineReasonJellyfin";
  return "offlineReasonBackend";
}
