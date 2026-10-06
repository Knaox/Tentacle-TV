import { hasDeviceNetwork } from "./deviceNetworkCheck";

/**
 * Apple TV : la page de vérification de connectivité du système lui-même
 * (celle que tvOS interroge pour détecter un portail captif). Voir
 * `deviceNetworkCheck.ts`.
 */
export function probeDeviceNetwork(): Promise<boolean> {
  return hasDeviceNetwork("https://captive.apple.com/hotspot-detect.html");
}
