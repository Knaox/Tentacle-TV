import { useCallback, useEffect, useRef, useState } from "react";
import { useTVReloadHold } from "./useTVReloadHold";

/**
 * ÉTAT MÉDIA + REFS PARTAGÉS du PlayerScreen — extrait VERBATIM (budget 300 lignes).
 * Les refs sont le « bus » qui relie écran ⇄ contrôles ⇄ pipeline de flux : positions,
 * gates, miroirs post-stream et points d'ancrage remplis plus tard (même pattern
 * qu'avant, seuls les propriétaires ont bougé). AUCUNE logique ici : uniquement de l'état.
 */
export function usePlayerMediaState() {
  const [paused, setPaused] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const displayTimeRef = useRef(0);
  const bufferedTimeRef = useRef(0);
  const lastDisplayUpdate = useRef(0);
  const positionRef = useRef(0);
  // Base position/skips PARTAGÉE contrôles ⇄ seek : chaque commit de seek la
  // synchronise — un +30 enchaîné part de la dernière cible.
  const controlsCurrentTimeRef = useRef(0);
  // Miroir de `paused` lu par les listeners/callbacks à deps [].
  const pausedStateRef = useRef(paused);
  pausedStateRef.current = paused;
  // FIN atteinte (onEnd natif) : gate le watchdog spinner, route le dismiss de
  // l'écran de fin vers la fiche. Reset au changement de source.
  const endedRef = useRef(false);
  // handleEnd — rempli après useTVPlayerEventHandlers (consommé plus tôt par
  // l'arbitre de fin ; même pattern que notifySeekRef).
  const handleEndRef = useRef<() => void>(() => {});

  // Bandeau d'erreur AUTO-EFFAÇABLE : une erreur posée s'efface seule après
  // ERROR_BANNER_TTL_MS (avant, rien ne l'éteignait hors changement d'item — le
  // bandeau rouge restait à vie même lecture repartie). Wrapper transparent :
  // les émetteurs (useTVErrorHandler, direct-stream recovery) et les éteigneurs
  // (bascule transcode, reset d'item) gardent la même API.
  // Pattern skipFlash (useTVPlayerControls) : timer + ref d'annulation.
  const ERROR_BANNER_TTL_MS = 8000;
  const [videoError, setVideoErrorState] = useState<string | null>(null);
  const videoErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setVideoError = useCallback((e: string | null) => {
    if (videoErrorTimerRef.current) { clearTimeout(videoErrorTimerRef.current); videoErrorTimerRef.current = null; }
    setVideoErrorState(e);
    if (e != null) {
      videoErrorTimerRef.current = setTimeout(() => {
        videoErrorTimerRef.current = null;
        setVideoErrorState(null);
      }, ERROR_BANNER_TTL_MS);
    }
  }, []);
  useEffect(() => () => { if (videoErrorTimerRef.current) clearTimeout(videoErrorTimerRef.current); }, []);
  const [isLoading, setIsLoading] = useState(true);
  // Premier onLoad reçu → les isLoading suivants sont du rebuffering (spinner
  // discret) et non plus le chargement initial (écran contextualisé).
  const [hasStarted, setHasStarted] = useState(false);
  const lastProgressTime = useRef(Date.now());

  // « Hold » de reload : lecteur gardé en pause pendant un reload de piste ou de
  // qualité, sans toucher l'intention `paused`.
  const { reloadHold, reloadHoldRef, holdForReload } = useTVReloadHold({ isLoading, setIsLoading });

  // Refs MIROIR des sorties post-stream (isDirectPlay / isPrismCore / mpvTrackMap)
  // lues au CLIC par les handlers audio/sous-titre — ces hooks d'état tournent AVANT
  // useTVStreamUrl, mais ces valeurs n'existent qu'APRÈS. Synchronisées par le pipeline.
  const isDirectPlayRef = useRef(false);
  // Lecture directe servie par PrismCore (tvOS) : HLS local à timeline absolue,
  // vrai multi-audio AVPlayer. Toujours faux sur Android.
  const isPrismCoreRef = useRef(false);
  const mpvTrackMapRef = useRef<Record<number, number>>({});
  // jellyfinIndex sous-titre → id de piste native ExoPlayer (side-loadées +
  // embarquées) — lu au CLIC par handleSubtitleChange (bascule native vs burn-in).
  const subtitleTrackMapRef = useRef<Record<number, number>>({});
  // notifySeek/checkTrigger : remplis après useTVPlayerEventHandlers.
  const notifySeekRef = useRef<(target: number, windowMs?: number, afterReload?: boolean) => void>(() => {});
  // setAudioIndex/setSubtitleIndex : remplis par le pipeline (hooks audio/sous-titre).
  const setAudioIndexRef = useRef<(i: number) => void>(() => {});
  const setSubtitleIndexRef = useRef<(i: number) => void>(() => {});
  // resetPrefsApplied : rempli après useTVTrackResolution.
  const resetPrefsAppliedRef = useRef<(() => void) | null>(null);
  // resetLoaded : rempli après useTVPlayerEventHandlers.
  const resetLoadedRef = useRef<() => void>(() => {});
  // Routage Retour unifié (rempli par useTVPlayerBack) : true = appui consommé.
  const routeBackRef = useRef<() => boolean>(() => false);

  return {
    paused, setPaused, displayTime, setDisplayTime, bufferedTime, setBufferedTime,
    displayTimeRef, bufferedTimeRef, lastDisplayUpdate, positionRef, controlsCurrentTimeRef,
    pausedStateRef, endedRef, handleEndRef,
    videoError, setVideoError, isLoading, setIsLoading, hasStarted, setHasStarted, lastProgressTime,
    reloadHold, reloadHoldRef, holdForReload,
    isDirectPlayRef, isPrismCoreRef, mpvTrackMapRef, subtitleTrackMapRef,
    notifySeekRef, setAudioIndexRef, setSubtitleIndexRef,
    resetPrefsAppliedRef, resetLoadedRef, routeBackRef,
  };
}

export type PlayerMediaState = ReturnType<typeof usePlayerMediaState>;
