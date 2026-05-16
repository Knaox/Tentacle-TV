import { memo } from "react";
import type { ViewStyle } from "react-native";
import { MPVPlayer, type MPVPlayerHandle, type MpvTrack } from "./MPVPlayer";
import { ExoPlayer } from "./ExoPlayer";

interface MemoizedPlayerProps {
  useExoPlayer: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  source: string;
  paused: boolean;
  playerStyle: ViewStyle;
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
}

export const MemoizedPlayer = memo(function MemoizedPlayer({
  useExoPlayer: isExo, exoRef, mpvRef, source, paused, playerStyle,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
}: MemoizedPlayerProps) {
  return isExo ? (
    <ExoPlayer
      ref={exoRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      audioPassthrough
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
      progressInterval={1000}
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
