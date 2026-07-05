import { useEffect, useRef, type MutableRefObject } from "react";
import type { MpvState } from "./useDesktopPlayer";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";

interface UseDesktopTransportArgs {
  transportRef?: PlayerTransportRef;
  state: MpvState;
  fileLoaded: boolean;
  mediaReady: boolean;
  isDirectPlay: boolean;
  lastAbsolutePosRef: MutableRefObject<number>;
  effectiveMpvOffset: MutableRefObject<number>;
  setPause: (paused: boolean) => Promise<void>;
  seek: (pos: number) => Promise<void>;
  setSpeed: (v: number) => Promise<void>;
  cancelAutoPlay: () => void;
  onPlayStateChange?: (paused: boolean) => void;
  onBufferingChange?: (buffering: boolean) => void;
}

/**
 * Watch Together côté desktop : surface de commande impérative (transportRef)
 * + signaux prêt/buffering/pause vers le moteur de sync. Extraction mécanique
 * de DesktopPlayer.
 */
export function useDesktopTransport({
  transportRef, state, fileLoaded, mediaReady, isDirectPlay,
  lastAbsolutePosRef, effectiveMpvOffset,
  setPause, seek, setSpeed, cancelAutoPlay,
  onPlayStateChange, onBufferingChange,
}: UseDesktopTransportArgs) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!transportRef) return;
    transportRef.current = {
      play: () => { void setPause(false); },
      pause: () => { void setPause(true); },
      // seek mpv en position stream (relative si PTS relatif en transcode)
      seekTo: (seconds: number) => {
        void seek(isDirectPlay ? seconds : Math.max(0, seconds - effectiveMpvOffset.current));
      },
      getPositionSeconds: () => lastAbsolutePosRef.current,
      isPaused: () => stateRef.current.paused,
      setRate: (rate: number) => { void setSpeed(rate); },
      cancelAutoNext: () => cancelAutoPlay(),
    };
    return () => { transportRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportRef, setPause, seek, setSpeed, isDirectPlay, cancelAutoPlay]);

  // « Prêt » pour le groupe : mediaReady = VRAI playback-restart mpv (première
  // frame rendue, même en pause — jamais forcé par le watchdog) — au premier
  // chargement ET après chaque rebuild de source. Ne pas exiger la lecture
  // effective : pendant un group-wait la room est en pause → mpv chargé mais
  // pausé n'émettrait jamais playing → deadlock (le groupe attend ce membre
  // qui attend le groupe). Émission dédupliquée par le moteur de sync.
  const readySentRef = useRef(false);
  useEffect(() => {
    if (mediaReady) {
      readySentRef.current = true;
      onBufferingChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady]);

  // Relai des VRAIS changements de paused-for-cache uniquement : fileLoaded est
  // lu par ref (pas en dépendance) — sinon sa remontée à true après un rebuild
  // émettrait buffering:false avant la lecture effective → resume prématuré du
  // groupe pendant que le transcode charge encore.
  const fileLoadedFlagRef = useRef(fileLoaded);
  fileLoadedFlagRef.current = fileLoaded;
  useEffect(() => {
    if (readySentRef.current && fileLoadedFlagRef.current) onBufferingChange?.(state.buffering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.buffering]);

  useEffect(() => {
    if (readySentRef.current) onPlayStateChange?.(state.paused);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.paused]);
}
