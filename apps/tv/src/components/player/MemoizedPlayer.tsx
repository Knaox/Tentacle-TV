import { memo } from "react";
import type { ViewStyle } from "react-native";
import { MPVPlayer, type MPVPlayerHandle, type MpvTrack } from "./MPVPlayer";
import { ExoPlayer, type ExoTextTrack } from "./ExoPlayer";

interface MemoizedPlayerProps {
  useExoPlayer: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  source: string;
  paused: boolean;
  /** Mute de transition (reload/reprise remux tvOS) : coupe l'audio de la session sortante. */
  muted?: boolean;
  playerStyle: ViewStyle;
  /** Pistes texte VTT pour le rendu natif (ExoPlayer Android + AVPlayer tvOS) */
  textTracks?: ExoTextTrack[];
  /** Index Jellyfin du sous-titre sélectionné (sélection native tvOS) */
  subtitleIndex?: number;
  /** Direct play vs transcode HLS — gate le sideload des sous-titres sur tvOS */
  isDirectPlay?: boolean;
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
}

export const MemoizedPlayer = memo(function MemoizedPlayer({
  useExoPlayer: isExo, exoRef, mpvRef, source, paused, muted, playerStyle, textTracks, subtitleIndex, isDirectPlay,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
}: MemoizedPlayerProps) {
  return isExo ? (
    <ExoPlayer
      ref={exoRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      audioPassthrough
      textTracks={textTracks}
      subtitleIndex={subtitleIndex}
      isDirectPlay={isDirectPlay}
      style={playerStyle}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
      onVideoSize={onVideoSize}
    />
  ) : (
    <MPVPlayer
      ref={mpvRef}
      source={source}
      paused={paused}
      muted={muted}
      progressInterval={1000}
      textTracks={textTracks}
      subtitleIndex={subtitleIndex}
      isDirectPlay={isDirectPlay}
      style={playerStyle}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
      onVideoSize={onVideoSize}
    />
  );
});
