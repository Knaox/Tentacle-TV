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
import type { MpvTrack, MPVPlayerHandle, ExoTextTrack } from "./playerTypes";
import { useExoMatchFrameRate, useExoTunneling } from "../../lib/exoSettings";

// Re-export types — ExoPlayer uses the same track/handle interface
export type { MpvTrack as ExoTrack, MPVPlayerHandle as ExoPlayerHandle };
export type { ExoTextTrack } from "./playerTypes";

interface ExoEvent {
  nativeEvent: {
    type: "progress" | "load" | "end" | "error" | "tracks" | "videoSize" | "subtitles";
    currentTime?: number;
    bufferedTime?: number;
    duration?: number;
    error?: string;
    tracks?: MpvTrack[];
    videoWidth?: number;
    videoHeight?: number;
    pixelRatio?: number;
    text?: string;
  };
}

interface ExoPlayerProps {
  source: string;
  paused: boolean;
  progressInterval?: number;
  audioPassthrough?: boolean;
  /** Pistes texte VTT (Jellyfin) chargées nativement pour le subtitleView Exo */
  textTracks?: ExoTextTrack[];
  /** Accepté pour la parité de signature tvOS (sélection sous-titre native) ;
   *  ignoré côté Android (sélection via la commande impérative setSubtitleTrack). */
  subtitleIndex?: number;
  /** Parité de signature tvOS (gate sideload HLS) ; ignoré côté Android (ExoPlayer
   *  sait sideloader sur HLS). */
  isDirectPlay?: boolean;
  /** Parité de signature tvOS (rendition OCR PrismCore) ; ignoré côté Android. */
  prismTextTrackIndex?: number | null;
  /** Cadence EXACTE du flux (Jellyfin `RealFrameRate`) : la vue native cale la
   *  fréquence d'affichage dessus — ExoPlayer, lui, la devine depuis des
   *  horodatages arrondis à la milliseconde et demande 24,39 ou 23,81. */
  frameRate?: number;
  style?: ViewStyle;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
  onSubtitles?: (text: string) => void;
}

const NativeExoView = requireNativeComponent<{
  source: string;
  paused: boolean;
  progressInterval: number;
  audioPassthrough: boolean;
  frameRate?: number;
  tunneling: boolean;
  textTracks?: ExoTextTrack[];
  onExoEvent: (event: ExoEvent) => void;
  style?: ViewStyle;
}>("ExoPlayerView");

function dispatchCommand(ref: React.RefObject<any>, command: string, args: any[]) {
  const handle = findNodeHandle(ref.current);
  if (handle == null) return;
  UIManager.dispatchViewManagerCommand(handle, command, args);
}

export const ExoPlayer = forwardRef<MPVPlayerHandle, ExoPlayerProps>(
  function ExoPlayer(
    { source, paused, progressInterval = 1000, audioPassthrough = true, frameRate, textTracks, style, onProgress, onLoad, onEnd, onError, onTracks, onVideoSize, onSubtitles },
    ref,
  ) {
    const nativeRef = useRef(null);
    // Réglage d'appareil, lu ICI (fichier Android seul) : rien à faire remonter
    // par PlayerScreen, et le lecteur se construit avec — un changement vaut
    // pour la lecture suivante.
    const tunneling = useExoTunneling();
    const matchFrameRate = useExoMatchFrameRate();

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => dispatchCommand(nativeRef, "seek", [seconds]),
      setAudioTrack: (id: number) => dispatchCommand(nativeRef, "setAudioTrack", [id]),
      setSubtitleTrack: (id: number) => dispatchCommand(nativeRef, "setSubtitleTrack", [id]),
      addSubtitleTrack: () => {},
      loadSubtitle: (url: string | null) => dispatchCommand(nativeRef, "loadSubtitle", [url ?? ""]),
    }));

    const handleEvent = useCallback(
      (event: ExoEvent) => {
        const { type, currentTime, bufferedTime, duration, error, tracks, videoWidth, videoHeight, pixelRatio, text } = event.nativeEvent;
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
          case "subtitles":
            onSubtitles?.(text ?? "");
            break;
        }
      },
      [onProgress, onLoad, onEnd, onError, onTracks, onVideoSize, onSubtitles],
    );

    return (
      <NativeExoView
        ref={nativeRef}
        source={source}
        paused={paused}
        progressInterval={progressInterval}
        audioPassthrough={audioPassthrough}
        frameRate={matchFrameRate ? frameRate : 0}
        tunneling={tunneling}
        textTracks={textTracks}
        onExoEvent={handleEvent}
        style={style}
      />
    );
  },
);
