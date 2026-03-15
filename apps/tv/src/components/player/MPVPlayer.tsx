import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  type ViewStyle,
} from "react-native";

export interface MpvTrack {
  id: number;
  type: "video" | "audio" | "sub";
  lang: string;
  title: string;
  codec: string;
  default: boolean;
  selected: boolean;
}

export interface MPVPlayerHandle {
  seek: (seconds: number) => void;
  setAudioTrack: (id: number) => void;
  setSubtitleTrack: (id: number) => void;
  addSubtitleTrack: (url: string) => void;
}

interface MpvEvent {
  nativeEvent: {
    type: "progress" | "load" | "end" | "error" | "tracks" | "videoSize";
    currentTime?: number;
    bufferedTime?: number;
    duration?: number;
    error?: string;
    tracks?: MpvTrack[];
    videoWidth?: number;
    videoHeight?: number;
    pixelRatio?: number;
  };
}

interface MPVPlayerProps {
  source: string;
  paused: boolean;
  progressInterval?: number;
  style?: ViewStyle;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

const NativeMpvView = requireNativeComponent<{
  source: string;
  paused: boolean;
  progressInterval: number;
  onMpvEvent: (event: MpvEvent) => void;
  style?: ViewStyle;
}>("MpvPlayerView");

function dispatchCommand(ref: React.RefObject<any>, command: string, args: any[]) {
  const handle = findNodeHandle(ref.current);
  if (handle == null) return;
  UIManager.dispatchViewManagerCommand(handle, command, args);
}

export const MPVPlayer = forwardRef<MPVPlayerHandle, MPVPlayerProps>(
  function MPVPlayer(
    { source, paused, progressInterval = 1000, style, onProgress, onLoad, onEnd, onError, onTracks, onVideoSize },
    ref,
  ) {
    const nativeRef = useRef(null);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => dispatchCommand(nativeRef, "seek", [seconds]),
      setAudioTrack: (id: number) => dispatchCommand(nativeRef, "setAudioTrack", [id]),
      setSubtitleTrack: (id: number) => dispatchCommand(nativeRef, "setSubtitleTrack", [id]),
      addSubtitleTrack: (url: string) => dispatchCommand(nativeRef, "addSubtitleTrack", [url]),
    }));

    const handleEvent = useCallback(
      (event: MpvEvent) => {
        const { type, currentTime, bufferedTime, duration, error, tracks, videoWidth, videoHeight, pixelRatio } = event.nativeEvent;
        switch (type) {
          case "progress":
            onProgress?.(currentTime ?? 0, bufferedTime ?? 0);
            break;
          case "load":
            onLoad?.(duration ?? 0);
            break;
          case "end":
            onEnd?.();
            break;
          case "error":
            onError?.(error ?? "Unknown error");
            break;
          case "tracks":
            onTracks?.(tracks ?? []);
            break;
          case "videoSize":
            onVideoSize?.(videoWidth ?? 0, videoHeight ?? 0, pixelRatio ?? 1);
            break;
        }
      },
      [onProgress, onLoad, onEnd, onError, onTracks, onVideoSize],
    );

    return (
      <NativeMpvView
        ref={nativeRef}
        source={source}
        paused={paused}
        progressInterval={progressInterval}
        onMpvEvent={handleEvent}
        style={style}
      />
    );
  },
);
