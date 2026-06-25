import { useCallback, useEffect, useRef } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

interface AutoPlayCtx {
  checkTrigger: (t: number) => void;
  nextEpisode: MediaItem | null;
  countdown: number | null;
  startAutoPlay: () => void;
}

/**
 * Regroupe les callbacks transmis aux players ExoPlayer/MPV :
 *  - handleLoad : fin de préparation + reportStart (la position de départ est
 *    gérée nativement via le fragment #tnt-start de l'URL)
 *  - handleProgress : maj position/buffered (timeline absolue), throttling 1s
 *  - handleEnd : autoPlay ou retour navigation
 *  - rebuffering watchdog
 *
 * Refs internes (...Ref) garantissent que les callbacks restent stables
 * pour les natifs (`useCallback` deps minimales) — sinon le release build
 * conserve la 1ʳᵉ closure et appelle une version périmée.
 */
export function useTVPlayerEventHandlers(args: {
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  paused: boolean;
  positionRef: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  displayTimeRef: React.MutableRefObject<number>;
  bufferedTimeRef: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  controlsCurrentTimeRef: React.MutableRefObject<number>;
  setDisplayTime: (n: number) => void;
  setBufferedTime: (n: number) => void;
  setIsLoading: (b: boolean) => void;
  reportStart: () => void;
  updatePosition: (pos: number, paused: boolean) => void;
  /** Premier progress ACCEPTÉ (position réelle validée) — la lecture est
   *  effectivement visible : masquer l'écran de chargement. */
  onPlaybackActive?: () => void;
  autoPlay: AutoPlayCtx;
  handleFinished: () => void;
}) {
  const {
    playerRef, paused,
    positionRef, pausedStateRef, displayTimeRef, bufferedTimeRef,
    lastDisplayUpdate, lastProgressTime, controlsCurrentTimeRef,
    setDisplayTime, setBufferedTime, setIsLoading,
    reportStart, updatePosition, onPlaybackActive, autoPlay, handleFinished,
  } = args;
  const onPlaybackActiveRef = useRef(onPlaybackActive);
  onPlaybackActiveRef.current = onPlaybackActive;

  const checkTriggerRef = useRef(autoPlay.checkTrigger);
  checkTriggerRef.current = autoPlay.checkTrigger;
  const reportStartRef = useRef(reportStart);
  reportStartRef.current = reportStart;
  const updatePositionRef = useRef(updatePosition);
  updatePositionRef.current = updatePosition;
  const handleFinishedRef = useRef(handleFinished);
  handleFinishedRef.current = handleFinished;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  // Fenêtre post-seek : le natif peut rapporter PLUSIEURS positions périmées
  // après un seek (un simple compteur n'en bloquait qu'une → la barre se
  // figeait sur l'ancienne position, surtout en pause). On ignore tout
  // callback éloigné de la cible jusqu'à convergence ou timeout.
  // `afterReload` (chargement/rechargement de source) : dès que le NOUVEAU
  // flux est prêt (load), sa première position non nulle est la position
  // réelle — un transcode HLS peut démarrer à quelques secondes de la cible
  // (granularité des segments), on l'accepte immédiatement au lieu de
  // bloquer l'écran de chargement jusqu'au timeout.
  const pendingSeekRef = useRef<{ target: number; until: number; afterReload: boolean } | null>(null);
  const notifySeek = useCallback((target: number, windowMs = 1500, afterReload = false) => {
    pendingSeekRef.current = { target, until: Date.now() + windowMs, afterReload };
  }, []);

  // La position de DÉMARRAGE (reprise, reload de piste) est gérée par le
  // NATIF via le fragment #tnt-start de l'URL (setMediaItem(item, startMs) /
  // loadfile start=+N) : aucun seek post-chargement nécessaire, aucune frame
  // à 0:00. La timeline est absolue dans tous les modes.
  // Le poller natif émet des progress AVANT que le flux soit prêt (position 0
  // pendant la préparation) — la lecture n'est « active » qu'après le load
  // (STATE_READY) ET un progress validé.
  const loadedRef = useRef(false);

  // Rechargement de source en cours de lecture (changement de piste/qualité) :
  // les progress de l'ANCIEN flux ne doivent plus valider la lecture, sinon
  // l'écran de chargement disparaît avant que le nouveau flux soit prêt.
  const resetLoaded = useCallback(() => {
    loadedRef.current = false;
  }, []);

  const handleLoad = useCallback((_duration: number) => {
    loadedRef.current = true;
    setIsLoading(false);
    reportStartRef.current();
  }, [setIsLoading]);

  const handleProgress = useCallback((currentTime: number, buffered: number) => {
    const t = Math.max(0, currentTime);
    const bufferedAbs = Math.max(0, buffered);

    // Fenêtre post-seek : positions périmées ignorées jusqu'à convergence
    // (pas de setIsLoading(false) ici : la position affichable n'est pas prête)
    if (pendingSeekRef.current) {
      const { target, until, afterReload } = pendingSeekRef.current;
      // afterReload (reprise / reload de piste-qualité) : la timeline est ABSOLUE et le
      // player SEEK vers `target` — sa 1ʳᵉ position n'est PAS la cible mais la position
      // PRÉ-SEEK (≈0 sur le remux/HLS absolu) ou le BORD LIVE (playlist EVENT). Exiger la
      // convergence PRÈS de la cible (et le flux chargé) — et NON « toute position >0.5 »,
      // qui acceptait ce point parasite → l'écran de chargement se levait à 0:01 puis la vidéo
      // resautait à T (double saut). On garde l'écran/l'image figée jusqu'à l'atterrissage réel
      // → un seul saut. Tolérance large (granularité segment + offset −3s) ; filet = timeout.
      const converged = afterReload
        ? (loadedRef.current && Math.abs(t - target) <= 6)
        : (Math.abs(t - target) <= 2.5);
      if (Date.now() > until || converged) {
        pendingSeekRef.current = null;
      } else {
        bufferedTimeRef.current = bufferedAbs;
        lastProgressTime.current = Date.now();
        return;
      }
    }
    // Lecture active : flux prêt (load) — ou position réelle non nulle, filet
    // si un re-render réarme loadedRef sans rechargement natif (le load ne
    // reviendra jamais, mais des progress > 0.5s prouvent que ça joue).
    if (loadedRef.current || t > 0.5) onPlaybackActiveRef.current?.();

    positionRef.current = t;
    controlsCurrentTimeRef.current = t;
    displayTimeRef.current = t;
    bufferedTimeRef.current = bufferedAbs;
    lastProgressTime.current = Date.now();
    setIsLoading(false);
    const now = Date.now();
    if (now - lastDisplayUpdate.current >= 1000) {
      lastDisplayUpdate.current = now;
      setDisplayTime(t);
      setBufferedTime(bufferedAbs);
    }
    updatePositionRef.current(t, pausedStateRef.current);
    checkTriggerRef.current(t);
  }, [bufferedTimeRef, controlsCurrentTimeRef, displayTimeRef, lastDisplayUpdate, lastProgressTime, pausedStateRef, positionRef, setBufferedTime, setDisplayTime, setIsLoading]);

  // Rebuffering watchdog : aucun progress callback pendant >2s
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      if (!paused && Date.now() - lastProgressTime.current > 2000) setIsLoading(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, lastProgressTime, setIsLoading]);

  const handleEnd = useCallback(() => {
    const ap = autoPlayRef.current;
    if (ap.nextEpisode && ap.countdown === null) ap.startAutoPlay();
    else if (ap.countdown === null) handleFinishedRef.current();
  }, []);

  return { handleLoad, handleProgress, handleEnd, notifySeek, resetLoaded, checkTriggerRef };
}
