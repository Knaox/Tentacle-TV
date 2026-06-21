import { NativeModules } from "react-native";
import type { HdrCapabilities } from "./hdrCapabilities.types";

export type { HdrCapabilities } from "./hdrCapabilities.types";

/**
 * Capacités HDR/DV de l'Apple TV via le module natif `HDRCapabilities`
 * (VideoToolbox, cf. `apps/tv/ios/TentacleTV/HDRCapabilities.m`). Mises en cache :
 * les capacités de décodage de la box ne changent pas en cours de session.
 *
 * Fallback prudent si le module est absent ou échoue (cas improbable : le natif
 * est livré avec ce JS) : HEVC/HDR10/HLG supposés OK (universels sur Apple TV,
 * tvOS tone-mappe si l'écran n'est pas HDR), mais Dolby Vision = false pour ne
 * JAMAIS déclarer une plage que la box ne saurait décoder (→ erreur de lecture).
 */
const FALLBACK: HdrCapabilities = {
  hevc: true,
  hdr10: true,
  hlg: true,
  dolbyVision: false,
  eligibleForHDR: false,
};

type NativeHDRModule = { getCapabilities?: () => Promise<Partial<HdrCapabilities>> };

let cache: HdrCapabilities | undefined;

export async function getHdrCapabilities(): Promise<HdrCapabilities> {
  if (cache) return cache;
  try {
    const mod = (NativeModules as { HDRCapabilities?: NativeHDRModule }).HDRCapabilities;
    const caps = mod?.getCapabilities ? await mod.getCapabilities() : FALLBACK;
    cache = { ...FALLBACK, ...caps };
  } catch {
    cache = FALLBACK;
  }
  return cache;
}
