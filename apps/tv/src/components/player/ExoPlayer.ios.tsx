import { forwardRef } from "react";
import type { ViewStyle } from "react-native";
import { AVPlayerSurface } from "./AVPlayerSurface";
import type { MPVPlayerHandle, MpvTrack, ExoTextTrack } from "./playerTypes";

// Variante tvOS du wrapper « ExoPlayer » (mode direct play) : sur Apple TV il
// n'y a qu'un lecteur natif (AVPlayer) pour tous les modes. On rend la surface
// commune. Les pistes texte natives (`textTracks`) sont volontairement IGNORÉES
// sur tvOS — les sous-titres passent par l'overlay JS partagé (cf.
// AVPlayerSurface). La prop est conservée pour la compat de signature.
export type { MpvTrack as ExoTrack, MPVPlayerHandle as ExoPlayerHandle } from "./playerTypes";
export type { ExoTextTrack } from "./playerTypes";

interface ExoPlayerProps {
  source: string;
  paused: boolean;
  progressInterval?: number;
  audioPassthrough?: boolean;
  textTracks?: ExoTextTrack[];
  /** Index Jellyfin du sous-titre sélectionné (rendu natif tvOS). */
  subtitleIndex?: number;
  style?: ViewStyle;
  onProgress?: (currentTime: number, bufferedTime: number) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTracks?: (tracks: MpvTrack[]) => void;
  onVideoSize?: (width: number, height: number, pixelRatio: number) => void;
}

export const ExoPlayer = forwardRef<MPVPlayerHandle, ExoPlayerProps>(
  function ExoPlayer({ audioPassthrough, ...rest }, ref) {
    // `textTracks` + `subtitleIndex` transmis à la surface (sous-titres natifs).
    return <AVPlayerSurface ref={ref} {...rest} />;
  },
);
