import { useEffect, useRef, type MutableRefObject } from "react";
import type { MpvState } from "./useDesktopPlayer";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";
import { wtLog } from "../watchTogether/wtLog";

/** Stabilité requise avant de déclarer « prêt » au groupe : un flux transcodé
 *  démarre souvent par 200-500 ms de lecture puis un re-buffering immédiat —
 *  libérer le group-wait à la première frame ferait repartir les autres
 *  membres pour les re-geler aussitôt (à-coups « lance/recharge »). */
const READY_STABLE_MS = 400;
/** Un seek encore en vol au-delà de ce délai est un far-seek (HLS : ffmpeg
 *  doit re-seeker/re-encoder) : le groupe doit l'attendre comme un buffering.
 *  mpv n'émet PAS toujours paused-for-cache pendant un seek — sans ce signal,
 *  le groupe avance et la boucle de drift re-seekerait en spirale. */
const SEEK_STALL_MS = 1200;

interface UseDesktopTransportArgs {
  transportRef?: PlayerTransportRef;
  state: MpvState;
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
 * + signaux prêt/buffering/pause vers le moteur de sync.
 *
 * Signal buffering (gate `mediaReady` — pendant un rebuild de source, c'est la
 * page qui a déjà déclaré le buffering au groupe) :
 *  - paused-for-cache mpv → buffering:true immédiat ;
 *  - seek en vol > SEEK_STALL_MS (far-seek HLS) → buffering:true ;
 *  - prêt ET stable READY_STABLE_MS → buffering:false (dédup par le moteur).
 */
export function useDesktopTransport({
  transportRef, state, mediaReady, isDirectPlay,
  lastAbsolutePosRef, effectiveMpvOffset,
  setPause, seek, setSpeed, cancelAutoPlay,
  onPlayStateChange, onBufferingChange,
}: UseDesktopTransportArgs) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const mediaReadyRef = useRef(mediaReady);
  mediaReadyRef.current = mediaReady;

  useEffect(() => {
    if (!transportRef) return;
    transportRef.current = {
      play: () => {
        wtLog("transport", "cmd play()", { pos: lastAbsolutePosRef.current.toFixed(1) });
        void setPause(false);
      },
      pause: () => {
        wtLog("transport", "cmd pause()", { pos: lastAbsolutePosRef.current.toFixed(1) });
        void setPause(true);
      },
      // seek mpv en position stream (relative si PTS relatif en transcode)
      seekTo: (seconds: number) => {
        const streamPos = isDirectPlay ? seconds : Math.max(0, seconds - effectiveMpvOffset.current);
        wtLog("transport", "cmd seekTo()", {
          targetFilmS: seconds.toFixed(1), streamPosS: streamPos.toFixed(1),
          fromS: lastAbsolutePosRef.current.toFixed(1), seeking: stateRef.current.seeking,
        });
        void seek(streamPos);
      },
      getPositionSeconds: () => lastAbsolutePosRef.current,
      isPaused: () => stateRef.current.paused,
      setRate: (rate: number) => {
        wtLog("transport", `cmd setRate(${rate})`);
        void setSpeed(rate);
      },
      cancelAutoNext: () => cancelAutoPlay(),
      isMediaReady: () => mediaReadyRef.current,
      isSeeking: () => stateRef.current.seeking,
    };
    return () => { transportRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportRef, setPause, seek, setSpeed, isDirectPlay, cancelAutoPlay]);

  useEffect(() => {
    if (!mediaReady || !onBufferingChange) return;
    if (state.buffering) {
      wtLog("transport", "signal buffering=true (paused-for-cache)", { pos: state.position.toFixed(1) });
      onBufferingChange(true);
      return;
    }
    if (state.seeking) {
      const timer = setTimeout(() => {
        wtLog("transport", `signal buffering=true (seek en vol > ${SEEK_STALL_MS}ms = far-seek)`, { pos: stateRef.current.position.toFixed(1) });
        onBufferingChange(true);
      }, SEEK_STALL_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      wtLog("transport", `signal buffering=false (prêt et stable ${READY_STABLE_MS}ms)`, { pos: stateRef.current.position.toFixed(1) });
      onBufferingChange(false);
    }, READY_STABLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady, state.buffering, state.seeking]);

  // Relai lecture/pause : seulement une fois le média prêt — les transitoires
  // de chargement (pause forcée à false avant loadfile…) ne sont pas des
  // intents utilisateur. Dédup et anti-écho côté moteur.
  useEffect(() => {
    if (mediaReadyRef.current) onPlayStateChange?.(state.paused);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.paused]);
}
