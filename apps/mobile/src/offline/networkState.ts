/**
 * Le réseau du téléphone vu par le magasin de connectivité : le module
 * expo-network en `require` protégé — la logique (type ramené à cinq valeurs,
 * « le lien est perdu ») vit dans le cœur, pure et testée (`networkLink`).
 *
 * Ce que vaut `isInternetReachable`, mesuré dans les sources natives
 * d'expo-network 8 : `isConnected` sur iOS, « un réseau actif existe » sur
 * Android 10+ — jamais « internet est validé ». Il n'est donc lu qu'en
 * `false` strict, et jamais sur un type inconnu. Ne pas le prendre pour un
 * détecteur de portail captif.
 */

import type { NetworkLinkState } from "@tentacle-tv/offline-core";

export { isLinkLost, mapNetworkType, type NetworkType } from "@tentacle-tv/offline-core";
export type { NetworkLinkState as NetworkState } from "@tentacle-tv/offline-core";

export interface NetworkModule {
  getNetworkStateAsync(): Promise<NetworkLinkState>;
  addNetworkStateListener(listener: (state: NetworkLinkState) => void): { remove(): void };
}

// Module natif optionnel, chargé en `require` protégé (patron haptique /
// SecureStore) : sans lui, tout marche sauf la sonde sur changement de réseau.
export let Network: NetworkModule | null = null;
try {
  Network = require("expo-network");
} catch {
  Network = null;
}
