import { useEffect, useRef, type MutableRefObject } from "react";
import type { MpvState } from "./useDesktopPlayer";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";
import { createPositionClock } from "./mpvPositionClock";
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
/** Après une commande de seek, le temps que mpv l'annonce (`seeking`) : pas
 *  d'extrapolation depuis l'ancienne position. */
const SEEK_SETTLE_MS = 150;
/** Sans `playback-restart` vu après un seek, on se fie à la position au bout
 *  de ce délai (un seek dans le cache peut ne rien annoncer de visible). */
const SEEK_RESTART_GRACE_MS = 1_500;
/** Posé : à moins de ça de la cible (secondes). */
const SETTLED_TOLERANCE_S = 0.15;

interface UseDesktopTransportArgs {
  transportRef?: PlayerTransportRef;
  state: MpvState;
  mediaReady: boolean;
  /** Réserve en cours de constitution (useMpvPrebuffer tient mpv en pause) :
   *  un lecteur qui remplit sa réserve n'est pas « prêt » pour le groupe. */
  prebuffering: boolean;
  isDirectPlay: boolean;
  /** Dernier `time-pos` brut (secondes de flux) et son instant de mesure. */
  positionRef: MutableRefObject<number>;
  positionAtRef: MutableRefObject<number>;
  /** `playback-restart` reçus (useMpvLifecycle) — un seek abouti en émet un. */
  restartCountRef: MutableRefObject<number>;
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
 * Position : `time-pos` arrive étranglé à 8 Hz puis passe l'IPC — lue telle
 * quelle, elle date de jusqu'à 125 ms. Elle est donc EXTRAPOLÉE depuis son
 * instant de mesure (`positionAtRef`, posé dans le processus principal) à la
 * vitesse courante, médiane de trois échantillons contre la gigue du pompage
 * (mpvPositionClock) — sauf en pause, en seek ou en buffering, où le flux ne
 * court pas.
 *
 * Signal buffering (gate `mediaReady` — pendant un rebuild de source, c'est la
 * page qui a déjà déclaré le buffering au groupe) :
 *  - paused-for-cache mpv ou réserve en cours → buffering:true immédiat ;
 *  - seek en vol > SEEK_STALL_MS (far-seek HLS) → buffering:true ;
 *  - prêt ET stable READY_STABLE_MS → buffering:false (dédup par le moteur).
 */
export function useDesktopTransport({
  transportRef, state, mediaReady, prebuffering, isDirectPlay,
  positionRef, positionAtRef, restartCountRef, lastAbsolutePosRef, effectiveMpvOffset,
  setPause, seek, setSpeed, cancelAutoPlay,
  onPlayStateChange, onBufferingChange,
}: UseDesktopTransportArgs) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const mediaReadyRef = useRef(mediaReady);
  mediaReadyRef.current = mediaReady;
  const prebufferingRef = useRef(prebuffering);
  prebufferingRef.current = prebuffering;
  const speedRef = useRef(1);
  const lastSeekAtRef = useRef(0);
  const seekRestartBaseRef = useRef(0);
  const clockRef = useRef(createPositionClock());

  useEffect(() => {
    if (!transportRef) return;
    transportRef.current = {
      precision: "coarse",
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
        lastSeekAtRef.current = Date.now();
        seekRestartBaseRef.current = restartCountRef.current;
        clockRef.current.reset();
        void seek(streamPos);
      },
      getPositionSeconds: () => {
        const s = stateRef.current;
        const now = Date.now();
        const raw = positionRef.current;
        const at = positionAtRef.current;
        if (at === 0) return lastAbsolutePosRef.current;
        const still = s.paused || s.seeking || s.buffering || now - lastSeekAtRef.current < SEEK_SETTLE_MS;
        if (still) { clockRef.current.reset(); return raw + effectiveMpvOffset.current; }
        clockRef.current.push(raw, at, speedRef.current);
        return (clockRef.current.estimate(now) ?? raw) + effectiveMpvOffset.current;
      },
      isPaused: () => stateRef.current.paused,
      setRate: (rate: number) => {
        wtLog("transport", `cmd setRate(${rate})`);
        speedRef.current = rate;
        void setSpeed(rate);
      },
      cancelAutoNext: () => cancelAutoPlay(),
      isMediaReady: () => mediaReadyRef.current && !prebufferingRef.current,
      isSeeking: () => stateRef.current.seeking,
      // Posé : pas de seek en vol ni de cache vide, position à moins de 150 ms
      // de la cible, et un `playback-restart` vu depuis le dernier seek (ou
      // assez de temps écoulé pour se fier à la position seule).
      isSettledAt: (targetSeconds: number) => {
        const s = stateRef.current;
        if (s.seeking || s.buffering || !mediaReadyRef.current || prebufferingRef.current) return false;
        const streamTarget = isDirectPlay ? targetSeconds : Math.max(0, targetSeconds - effectiveMpvOffset.current);
        if (Math.abs(positionRef.current - streamTarget) > SETTLED_TOLERANCE_S) return false;
        const seekIssued = lastSeekAtRef.current !== 0;
        const restarted = restartCountRef.current !== seekRestartBaseRef.current;
        return !seekIssued || restarted || Date.now() - lastSeekAtRef.current > SEEK_RESTART_GRACE_MS;
      },
    };
    return () => { transportRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportRef, setPause, seek, setSpeed, isDirectPlay, cancelAutoPlay]);

  useEffect(() => {
    if (!mediaReady || !onBufferingChange) return;
    if (state.buffering || prebuffering) {
      wtLog("transport", `signal buffering=true (${prebuffering ? "réserve en cours" : "paused-for-cache"})`, { pos: state.position.toFixed(1) });
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
  }, [mediaReady, prebuffering, state.buffering, state.seeking]);

  // Relai lecture/pause : seulement une fois le média prêt — les transitoires
  // de chargement (pause forcée à false avant loadfile…) ne sont pas des
  // intents utilisateur. Dédup et anti-écho côté moteur.
  useEffect(() => {
    if (mediaReadyRef.current) onPlayStateChange?.(state.paused);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.paused]);
}
