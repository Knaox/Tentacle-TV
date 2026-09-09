import type { OfflineReason } from "@tentacle-tv/offline-core";

/**
 * La clé, QUALIFIÉE par son espace, qui dit POURQUOI l'application est hors
 * ligne. Une seule formulation pour la bulle d'état, le bandeau de bascule et
 * l'état vide : deux textes qui divergent sur la même panne feraient douter
 * de l'un des deux.
 */
export function offlineReasonKey(reason: OfflineReason): string {
  if (reason === "network") return "downloads:offlineReasonNetwork";
  if (reason === "jellyfin") return "downloads:offlineReasonJellyfin";
  if (reason === "timeout") return "offline:reasonTimeout";
  return "downloads:offlineReasonBackend";
}
