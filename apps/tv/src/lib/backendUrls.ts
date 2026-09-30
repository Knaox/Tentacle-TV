import {
  setConfigBackendUrl,
  setNotificationsBackendUrl,
  setPairingBackendUrl,
  setPreferencesBackendUrl,
  setStreamingConfigBackendUrl,
  setTicketsBackendUrl,
  setWsBackendUrl,
} from "@tentacle-tv/api-client";

/**
 * Pose l'adresse du serveur Tentacle sur TOUS les clients du backend, d'un
 * seul geste — au démarrage comme au jumelage.
 *
 * Le jumelage tenait sa propre liste, plus courte que celle du démarrage : la
 * config de lecture directe et le canal temps réel restaient sur l'adresse du
 * lancement (`http://localhost` quand rien n'était jumelé) jusqu'à la relance.
 * Après un premier jumelage, pas de lecture directe, pas de canal de session.
 * Une seule liste, ici, ne peut plus diverger.
 *
 * Le client Jellyfin n'y est pas : son adresse (`/api/jellyfin`) se pose sur
 * l'instance, que l'appelant tient.
 */
export function applyBackendUrl(url: string): void {
  setPairingBackendUrl(url);
  setPreferencesBackendUrl(url);
  setTicketsBackendUrl(url);
  setNotificationsBackendUrl(url);
  setConfigBackendUrl(url);
  setStreamingConfigBackendUrl(url);
  setWsBackendUrl(url);
}
