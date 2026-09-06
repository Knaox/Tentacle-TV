/**
 * Le réseau du téléphone vu par le magasin de connectivité : le module
 * expo-network en `require` protégé, le type de réseau ramené à cinq valeurs,
 * et « le lien est perdu » (aucun réseau — un `UNKNOWN` n'en est pas un).
 */

export interface NetworkState {
  type?: string;
  isConnected?: boolean;
}

export interface NetworkModule {
  getNetworkStateAsync(): Promise<NetworkState>;
  addNetworkStateListener(listener: (state: NetworkState) => void): { remove(): void };
}

// Module natif optionnel, chargé en `require` protégé (patron haptique /
// SecureStore) : sans lui, tout marche sauf la sonde sur changement de réseau.
export let Network: NetworkModule | null = null;
try {
  Network = require("expo-network");
} catch {
  Network = null;
}

export type NetworkType = "wifi" | "cellular" | "none" | "other" | "unknown";

export function mapNetworkType(state: NetworkState): NetworkType {
  if (state.isConnected === false) return "none";
  switch ((state.type ?? "").toUpperCase()) {
    case "WIFI":
      return "wifi";
    case "CELLULAR":
      return "cellular";
    case "NONE":
      return "none";
    case "UNKNOWN":
    case "":
      return "unknown";
    default:
      return "other";
  }
}

/** Le téléphone n'a plus aucun réseau (un `UNKNOWN` n'est jamais une bascule). */
export function isLinkLost(state: NetworkState): boolean {
  return state.isConnected === false && (state.type ?? "").toUpperCase() === "NONE";
}
