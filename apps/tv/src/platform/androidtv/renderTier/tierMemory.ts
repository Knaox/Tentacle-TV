import { useEffect } from "react";
import { deviceNative, RENDER_TIER } from "./tierNative";

/** Le temps que l'écran recouvert se cache et que ses images se relâchent. */
const SETTLE_MS = 1200;

/**
 * Lite : un écran qui recouvre toute l'interface (le lecteur) vide, une fois
 * posé, les images que plus rien n'affiche — celles de l'écran recouvert,
 * relâchées par `CoveredScreens` (`LiteMemory.release`, natif). Les vues et le
 * focus de l'écran recouvert restent : on y revient au même endroit. Normal :
 * rien.
 */
export function useReleaseHiddenImages(reason: string): void {
  useEffect(() => {
    const native = deviceNative;
    if (RENDER_TIER !== "lite" || !native?.releaseHiddenImages) return;
    const timer = setTimeout(() => native.releaseHiddenImages?.(reason), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [reason]);
}
