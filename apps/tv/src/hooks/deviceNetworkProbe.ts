import { hasDeviceNetwork } from "./deviceNetworkCheck";

/**
 * Android TV : la page de vérification de connectivité du système lui-même
 * (celle qu'Android interroge pour savoir s'il a Internet). Voir
 * `deviceNetworkCheck.ts`.
 */
export function probeDeviceNetwork(): Promise<boolean> {
  return hasDeviceNetwork("https://connectivitycheck.gstatic.com/generate_204");
}
