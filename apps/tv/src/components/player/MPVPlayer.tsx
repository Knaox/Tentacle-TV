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
import { mpvOptionOverrides } from "@tentacle-tv/shared";
import { MPV_SOFTWARE_DECODE, mpvDecoderVerdict, parseMpvHwdec } from "@tentacle-tv/tv-core";
import type { MpvTrack, MPVPlayerHandle, ExoTextTrack } from "./playerTypes";
import { PLAYBACK_TIER } from "../../lib/playbackTier";
import { plog } from "../../utils/playerDiag";

/** Les options du mode Lite (shared `mpvOptionOverrides`) ; `undefined` en mode normal. */
const LITE = PLAYBACK_TIER === "lite";
const OPTION_OVERRIDES = LITE ? mpvOptionOverrides(PLAYBACK_TIER) : undefined;

// Types publics centralisés dans playerTypes.ts (neutres) — réexport pour
// préserver tous les `import … from "./MPVPlayer"` existants.
export type { MpvTrack, MPVPlayerHandle } from "./playerTypes";

interface MpvEvent {
  nativeEvent: {
    type: "progress" | "load" | "firstFrame" | "end" | "error" | "tracks" | "videoSize" | "decoder";
    /** `decoder` : `hwdec-current` de mpv, et la hauteur de l'image décodée. */
    hwdec?: string;
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
  /** Parité de signature avec la variante tvOS (mute de transition) — non utilisé par le natif Android. */
  muted?: boolean;
  progressInterval?: number;
  style?: ViewStyle;
  /** Acceptés pour la parité de signature avec la variante tvOS (sous-titres
   *  natifs) ; ignorés côté Android (MPV/transcode → overlay JS). */
  textTracks?: ExoTextTrack[];
  subtitleIndex?: number;
  /** Parité de signature tvOS (gate sideload HLS) ; ignoré côté Android. */
  isDirectPlay?: boolean;
  /** Parité de signature tvOS (rendition OCR PrismCore) ; ignoré côté Android. */
  prismTextTrackIndex?: number | null;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onLoad?: (duration: number) => void;
  /** Android : première image posée sur la surface, son prêt (tv-core `startGate`). */
  onFirstFrame?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

const NativeMpvView = requireNativeComponent<{
  source: string;
  paused: boolean;
  progressInterval: number;
  optionOverrides?: Array<[string, string]>;
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
    { source, paused, progressInterval = 1000, style, onProgress, onLoad, onFirstFrame, onEnd, onError, onTracks, onVideoSize },
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
        const { type, currentTime, bufferedTime, duration, error, tracks, videoWidth, videoHeight, pixelRatio, hwdec } = event.nativeEvent;
        switch (type) {
          case "decoder": {
            // La garde (tv-core `mpvDecoderVerdict`) : en Lite, jamais de décodage
            // logiciel — la main rendue à Exo, comme une erreur du moteur.
            const decoder = parseMpvHwdec(hwdec);
            plog("mpv", `décodeur ${hwdec ?? "?"} (${videoHeight ?? 0} lignes)`);
            if (mpvDecoderVerdict({ lite: LITE, hwdec: decoder, videoHeight: videoHeight ?? 0 }) === "toExo") onError?.(MPV_SOFTWARE_DECODE);
            break;
          }
          case "progress":
            onProgress?.(currentTime ?? 0, bufferedTime ?? 0);
            break;
          case "load":
            onLoad?.(duration ?? 0);
            break;
          case "firstFrame":
            onFirstFrame?.();
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
      [onProgress, onLoad, onFirstFrame, onEnd, onError, onTracks, onVideoSize],
    );

    return (
      <NativeMpvView
        ref={nativeRef}
        source={source}
        paused={paused}
        progressInterval={progressInterval}
        optionOverrides={OPTION_OVERRIDES}
        onMpvEvent={handleEvent}
        style={style}
      />
    );
  },
);
