/**
 * Le réseau du téléphone, tel qu'expo-network le rapporte, en forme PURE
 * (testable sans Expo). Ce que valent les champs, mesuré dans les sources
 * natives d'expo-network 8 :
 * - `isConnected` : un réseau est associé ;
 * - `isInternetReachable` : `isConnected` sur iOS, « un réseau actif existe »
 *   sur Android 10+ — jamais « internet est validé ». Il n'apporte un signal
 *   propre que sur Android 9 et avant (Wi-Fi en association : `false`), et
 *   sur le chemin d'exception (`type` UNKNOWN + `false`), qu'il ne faut PAS
 *   prendre pour une bascule. D'où : lu en `false` STRICT, jamais sur un type
 *   inconnu.
 */

export interface NetworkLinkState {
  type?: string;
  isConnected?: boolean;
  isInternetReachable?: boolean | null;
}

export type NetworkType = "wifi" | "cellular" | "none" | "other" | "unknown";

/** Un réseau nommé qui n'a pas de données est, pour nous, « aucun ». */
function dataless(state: NetworkLinkState): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function mapNetworkType(state: NetworkLinkState): NetworkType {
  if (state.isConnected === false) return "none";
  switch ((state.type ?? "").toUpperCase()) {
    case "WIFI":
      return dataless(state) ? "none" : "wifi";
    case "CELLULAR":
      return dataless(state) ? "none" : "cellular";
    case "NONE":
      return "none";
    case "UNKNOWN":
    case "":
      return "unknown";
    default:
      return dataless(state) ? "none" : "other";
  }
}

/** Le téléphone n'a plus de lien utile. « Inconnu » n'est JAMAIS une bascule : l'ignorance n'est pas une panne. */
export function isLinkLost(state: NetworkLinkState): boolean {
  const type = (state.type ?? "").toUpperCase();
  if (type === "" || type === "UNKNOWN") return false;
  if (type === "NONE") return state.isConnected === false;
  return dataless(state);
}
