import { memo, useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import Video, { type OnLoadData, type OnProgressData } from "react-native-video";
import { PREVIEW_VIDEO_SURFACE } from "./previewVideoSurface";
import type { PreviewVideoElementProps } from "./previewVideoTypes";

/**
 * La vidéo d'aperçu par react-native-video — AVPlayer sur Apple TV (et le
 * repli d'Android TV sur un binaire sans lecteur d'aperçu natif). La surface
 * (et son « jamais focalisable ») vient de `previewVideoSurface` ; pas de
 * volet noir avant l'image.
 */
export const RnvPreviewVideo = memo(function RnvPreviewVideo({
  uri, hls, startAt, playing, muted, volume, progressIntervalMs, onFirstFrame, onLoad, onProgress, onError, onEnd,
}: PreviewVideoElementProps) {
  // Mémorisée : un objet neuf à chaque rendu rechargerait la source native.
  const source = useMemo(
    () => ({ uri, type: hls ? "m3u8" : undefined, startPosition: Math.round(startAt * 1000) }),
    [uri, hls, startAt],
  );
  const handleLoad = useCallback((data: OnLoadData) => onLoad(data.duration > 0 ? data.duration : 0), [onLoad]);
  const handleProgress = useCallback(
    (data: OnProgressData) => onProgress(data.currentTime, data.seekableDuration > 0 ? data.seekableDuration : 0),
    [onProgress],
  );
  return (
    <Video
      {...PREVIEW_VIDEO_SURFACE}
      source={source}
      style={StyleSheet.absoluteFill}
      paused={!playing}
      muted={muted}
      volume={volume}
      controls={false}
      resizeMode="cover"
      preventsDisplaySleepDuringVideoPlayback={false}
      hideShutterView
      shutterColor="transparent"
      progressUpdateInterval={progressIntervalMs}
      onReadyForDisplay={onFirstFrame}
      onLoad={handleLoad}
      onProgress={handleProgress}
      onError={onError}
      onEnd={onEnd}
    />
  );
});
