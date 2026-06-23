import { useCallback, useMemo, useState } from "react";
import { Dimensions, type ViewStyle } from "react-native";

const SCREEN = Dimensions.get("window");

/**
 * Gère l'aspect ratio réel de la vidéo (rapporté par le natif via onVideoSize)
 * et en dérive le style de surface du player : letterbox/pillarbox pour
 * respecter le ratio source sans déformer l'image (plein écran tant que le
 * ratio n'est pas connu).
 */
export function useTVPlayerStyle() {
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  const handleVideoSize = useCallback((width: number, height: number, pixelRatio: number) => {
    if (width > 0 && height > 0) setVideoAspect((width / height) * pixelRatio);
  }, []);

  const playerStyle = useMemo<ViewStyle>(() => {
    if (!videoAspect) return { width: SCREEN.width, height: SCREEN.height };
    const screenAspect = SCREEN.width / SCREEN.height;
    if (videoAspect > screenAspect) {
      return { width: SCREEN.width, height: Math.round(SCREEN.width / videoAspect) };
    }
    return { width: Math.round(SCREEN.height * videoAspect), height: SCREEN.height };
  }, [videoAspect]);

  return { videoAspect, handleVideoSize, playerStyle };
}
