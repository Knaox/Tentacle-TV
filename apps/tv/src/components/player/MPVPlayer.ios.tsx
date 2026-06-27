import { forwardRef } from "react";
import type { ViewStyle } from "react-native";
import { AVPlayerSurface } from "./AVPlayerSurface";
import type { MPVPlayerHandle, MpvTrack, ExoTextTrack } from "./playerTypes";

// Variante tvOS du wrapper « MPV » (mode transcode) : pas de natif MPV sur
// Apple TV → on rend la surface AVPlayer commune. Metro résout ce fichier sur
// tvOS et `MPVPlayer.tsx` (natif Android) sur Android. Les sous-titres restent
// natifs même en transcode (sideload VTT lu par-dessus le flux HLS).
export type { MpvTrack, MPVPlayerHandle } from "./playerTypes";

interface MPVPlayerProps {
  source: string;
  paused: boolean;
  /** Coupe l'audio pendant une transition (reload/reprise) — passé tel quel à AVPlayerSurface (spread). */
  muted?: boolean;
  progressInterval?: number;
  style?: ViewStyle;
  textTracks?: ExoTextTrack[];
  subtitleIndex?: number;
  /** Direct play vs transcode HLS — gate le sideload des sous-titres (cf. AVPlayerSurface). */
  isDirectPlay?: boolean;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

export const MPVPlayer = forwardRef<MPVPlayerHandle, MPVPlayerProps>(
  function MPVPlayer(props, ref) {
    return <AVPlayerSurface ref={ref} {...props} />;
  },
);
