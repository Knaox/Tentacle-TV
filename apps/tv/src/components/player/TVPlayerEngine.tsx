import { MemoizedPlayer } from "./MemoizedPlayer";
import type { TVPlayerViewProps } from "./TVPlayerView";

export type TVPlayerEngineProps = Pick<
  TVPlayerViewProps,
  | "streamUrl" | "paused" | "playerPaused" | "hasStarted" | "reloadFrameSec" | "useExoPlayer" | "exoRef" | "mpvRef"
  | "playerStyle" | "textTracks" | "subtitleIndex" | "isDirectPlay" | "prismTextTrackIndex" | "frameRate"
  | "onLoad" | "onProgress" | "onEnd" | "onError" | "onTracks" | "onVideoSize"
>;

/**
 * Le MOTEUR du lecteur, monté à l'identique sous les deux habillages — celui
 * d'Android TV (`TVPlayerView`) et celui de la refonte Apple TV : l'habillage
 * change, jamais la façon de monter la vidéo.
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
