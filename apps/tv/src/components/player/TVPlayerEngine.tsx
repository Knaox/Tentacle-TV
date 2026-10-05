import { MemoizedPlayer } from "./MemoizedPlayer";
import type { PlayerStageBaseProps } from "./playerStageBaseProps";

export type TVPlayerEngineProps = Pick<
  PlayerStageBaseProps,
  | "streamUrl" | "paused" | "playerPaused" | "hasStarted" | "reloadFrameSec" | "useExoPlayer" | "exoRef" | "mpvRef"
  | "playerStyle" | "textTracks" | "subtitleIndex" | "isDirectPlay" | "prismTextTrackIndex" | "frameRate"
  | "onLoad" | "onProgress" | "onEnd" | "onError" | "onTracks" | "onVideoSize"
>;

/**
 * Le MOTEUR du lecteur (ExoPlayer ou mpv sur Android TV, AVPlayer sur Apple
 * TV), monté sous l'habillage refondu : l'habillage ne change jamais la façon
 * de monter la vidéo.
 */
export function TVPlayerEngine(props: TVPlayerEngineProps) {
  return (
    <MemoizedPlayer
      useExoPlayer={props.useExoPlayer} exoRef={props.exoRef} mpvRef={props.mpvRef}
      source={props.streamUrl} paused={props.playerPaused ?? props.paused} playerStyle={props.playerStyle}
      // Mute de transition (filet secondaire) : tant que l'image figée masque la vidéo, couper l'audio de
      // la session sortante. Le vrai blocage du son vient du « hold » (playerPaused) côté PlayerScreen.
      muted={props.reloadFrameSec != null && props.hasStarted}
      textTracks={props.textTracks} subtitleIndex={props.subtitleIndex} isDirectPlay={props.isDirectPlay}
      prismTextTrackIndex={props.prismTextTrackIndex}
      frameRate={props.frameRate}
      onLoad={props.onLoad} onProgress={props.onProgress} onEnd={props.onEnd}
      onError={props.onError} onTracks={props.onTracks} onVideoSize={props.onVideoSize}
    />
  );
}
