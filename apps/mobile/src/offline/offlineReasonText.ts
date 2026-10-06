import { connectivityCaseOf, connectivityCopy, type ConnectivityCopy } from "@tentacle-tv/shared";
import type { OfflineReason } from "@tentacle-tv/offline-core";

/**
 * Les clés, QUALIFIÉES par leur espace, qui disent POURQUOI l'application est
 * hors ligne — les trois cas de la règle partagée (`connectivityCase.ts`) :
 * l'appareil sans réseau, le serveur Tentacle muet, Jellyfin injoignable.
 * Une seule formulation pour le message de bascule, la bulle d'état et l'état
 * vide : deux textes qui divergent sur la même panne feraient douter de l'un
 * des deux. Sans cause connue, le serveur.
 */
export function offlineReasonCopy(reason: OfflineReason): ConnectivityCopy {
  return connectivityCopy(connectivityCaseOf(reason) ?? "server");
}
