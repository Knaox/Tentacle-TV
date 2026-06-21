import type { HdrCapabilities } from "./hdrCapabilities.types";

export type { HdrCapabilities } from "./hdrCapabilities.types";

/**
 * Variante par défaut (Android & autres). Le `DeviceProfile` tvOS
 * (`tvosDeviceProfile.ts`) n'est importé que par `useTVStreamUrl.ios.ts`, donc
 * cette implémentation n'est pas réellement consommée hors tvOS — elle existe
 * pour la résolution Metro et reste permissive par sûreté.
 *
 * tvOS utilise `hdrCapabilities.ios.ts` (module natif `HDRCapabilities`).
 */
export async function getHdrCapabilities(): Promise<HdrCapabilities> {
  return { hevc: true, hdr10: true, hlg: true, dolbyVision: true, eligibleForHDR: true };
}
