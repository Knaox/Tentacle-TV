import { useEffect } from "react";
import { LITE_RELEASE_SETTLE_MS } from "@tentacle-tv/tv-core";
import { deviceNative, RENDER_TIER } from "./tierNative";

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
    const timer = setTimeout(() => native.releaseHiddenImages?.(reason), LITE_RELEASE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [reason]);
}
