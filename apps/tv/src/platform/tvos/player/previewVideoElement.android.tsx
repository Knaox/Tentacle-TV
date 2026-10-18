import { memo, useCallback, useMemo } from "react";
import { StyleSheet, UIManager, requireNativeComponent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { RnvPreviewVideo } from "./previewVideoRnv";
import type { PreviewVideoElementProps } from "./previewVideoTypes";

export type { PreviewVideoElementProps } from "./previewVideoTypes";

/**
 * La vidéo d'aperçu sur Android TV : le lecteur d'aperçu natif
 * (`TentaclePreviewVideo`, `exoplayer/PreviewVideoView.kt`) — une PlayerView
 * SANS contrôleur sur une TextureView, aucun focus possible. La vue de
 * react-native-video gonflait à chaque aperçu un contrôleur entier : un
 * blocage du fil UI au départ de l'aperçu suivant, et un bouton qui volait le
 * focus de la carte (lot ba1016). Un binaire qui ne l'embarque pas :
 * react-native-video, comme avant.
 */

interface PreviewNativeEvent {
  type: "firstFrame" | "load" | "progress" | "end" | "error";
  currentTime?: number;
  duration?: number;
  error?: string;
}

interface NativePreviewVideoProps {
  source: { uri: string; hls: boolean; startMs: number };
  paused: boolean;
  muted: boolean;
  volume: number;
  progressInterval: number;
  onExoEvent: (event: NativeSyntheticEvent<PreviewNativeEvent>) => void;
  style?: StyleProp<ViewStyle>;
}

const VIEW_NAME = "TentaclePreviewVideo";

const NativePreviewVideo =
  UIManager.getViewManagerConfig(VIEW_NAME) != null ? requireNativeComponent<NativePreviewVideoProps>(VIEW_NAME) : null;

const NativeElement = memo(function NativeElement({
  uri, hls, startAt, playing, muted, volume, progressIntervalMs, onFirstFrame, onLoad, onProgress, onError, onEnd,
}: PreviewVideoElementProps) {
  const source = useMemo(() => ({ uri, hls, startMs: Math.round(startAt * 1000) }), [uri, hls, startAt]);
  const onExoEvent = useCallback(
    (event: NativeSyntheticEvent<PreviewNativeEvent>) => {
      const { type, currentTime, duration } = event.nativeEvent;
      if (type === "firstFrame") onFirstFrame();
      else if (type === "load") onLoad(duration ?? 0);
      else if (type === "progress") onProgress(currentTime ?? 0, duration ?? 0);
      else if (type === "end") onEnd();
      else if (type === "error") onError();
    },
    [onFirstFrame, onLoad, onProgress, onEnd, onError],
  );
  if (!NativePreviewVideo) return null;
  return (
    <NativePreviewVideo
      source={source}
      paused={!playing}
      muted={muted}
      volume={volume}
      progressInterval={progressIntervalMs}
      onExoEvent={onExoEvent}
      style={StyleSheet.absoluteFill}
    />
  );
});

export const PreviewVideoElement = memo(function PreviewVideoElement(props: PreviewVideoElementProps) {
  return NativePreviewVideo ? <NativeElement {...props} /> : <RnvPreviewVideo {...props} />;
});
