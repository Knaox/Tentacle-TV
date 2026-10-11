import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  createPlayerBack,
  createTrailerControls,
  TRAILER_NO_SURFACE,
  trailerBackLayers,
  trailerChromeShown,
  trailerSelectAction,
  type SkipFlashState,
  type TrailerPanel,
  type TrailerState,
} from "@tentacle-tv/tv-core";
import { PLAYER_TIMERS } from "../../hooks/playerTimers";
import { SCRUB_INPUT } from "../../hooks/scrubInput";
import { useScrubGestures } from "../../hooks/useScrubGestures";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useTrailerRemote } from "../../platform/tvos/screens/trailer";
import { seekFlashLabel } from "../../redesign/screens/player/playerLabels";
import type { TrailerTimeline } from "../../redesign/screens/trailer/trailerTypes";
import type { TrailerPlayerHandle, TrailerProgress } from "../../screens/trailer/types";
import { useBackLayers } from "../back/BackScope";

/**
 * La LECTURE de la bande-annonce : les contrôles du grand lecteur, tels quels
 * (tv-core `createTrailerControls` : saut −10 / +30 s cumulé et son badge,
 * maintien accéléré, défilement, glisser du pavé, OK puis OK, extinction du
 * chrome à 3 s), la télécommande par l'entrée unique, et le Retour en couches
 * (tv-core `trailerBackLayers` : défilement ou grâce, panneau, chrome, page).
 * L'état que la vue lit en sort : chrome, barre, cible d'un défilement,
 * badge d'un saut, pause.
 */

export interface TrailerPlaybackArgs {
  state: TrailerState;
  store: FocusStore;
  panel: TrailerPanel | null;
  engine: RefObject<TrailerPlayerHandle | null>;
  screenFocused: boolean;
  openPanel: (panel: TrailerPanel) => void;
  closePanel: () => void;
  leave: () => void;
}

export function useTrailerPlayback(args: TrailerPlaybackArgs) {
  const { state, store, panel, screenFocused } = args;
  const { t } = useTranslation();
  const latest = useRef(args);
  latest.current = args;

  const [paused, setPaused] = useState(false);
  const [timeline, setTimeline] = useState<TrailerTimeline | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [skipFlash, setSkipFlash] = useState<SkipFlashState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [graceActive, setGraceActive] = useState(false);

  // Les miroirs du DERNIER rendu : ce que les contrôles lisent au geste.
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const view = useRef({ state, chromeVisible, panel });
  view.current = { state, chromeVisible, panel };
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;

  const [controls] = useState(() => createTrailerControls({
    readPosition: () => positionRef.current,
    writePosition: (seconds) => { positionRef.current = seconds; },
    readDuration: () => durationRef.current,
    readPaused: () => pausedRef.current,
    seek: (seconds) => {
      positionRef.current = seconds;
      latest.current.engine.current?.seekTo(seconds);
      setTimeline((prev) => (prev ? { ...prev, position: seconds } : prev));
    },
    playPause: () => setPaused((was) => !was),
    scrubPause: setPaused,
    onSkipFlash: setSkipFlash,
    onScrubbing: setScrubbing,
    onPosition: setScrubPosition,
    onSpeedLabel: () => undefined,
    onCountdown: () => undefined,
    readView: () => ({ ...view.current, focusedKey: store.focusedKey() }),
    onChromeVisible: setChromeVisible,
    leave: () => latest.current.leave(),
  }, { profile: SCRUB_INPUT, timers: PLAYER_TIMERS }));
  useEffect(() => () => controls.destroy(), [controls]);

  // Le chrome se rallume aux transitions de lecture, de pause et de panneau.
  useEffect(() => {
    controls.syncOverlay();
    return () => controls.cancelHideTimer();
  }, [controls, state, paused, panel]);

  useTrailerRemote(controls.remote, store, screenFocused && state === "playing");
  useScrubGestures({
    enabled: screenFocused && state === "playing" && panel === null,
    readTouchMode: controls.readTouchMode,
    readLastPressAt: controls.readLastPressAt,
    onTouchStart: controls.scrub.touchStart,
    onStartScrub: controls.scrub.startDrag,
    onNudgeScrub: controls.scrub.nudgeScrub,
    onEndScrub: controls.scrub.endDrag,
    onWake: controls.wakeFromTouch,
    durationRef,
  });

  const shown = trailerChromeShown(state, chromeVisible, scrubbing);
  const shownRef = useRef(shown.chrome);
  shownRef.current = shown.chrome;

  // Le Retour : états passagers d'abord (défilement annulé, grâce), puis les couches.
  const [back] = useState(() => createPlayerBack({
    isScrubbing: () => scrubbingRef.current,
    readSurface: () => TRAILER_NO_SURFACE,
    cancelScrub: () => controls.scrub.cancelScrub(),
    dismissSurface: () => false,
    dismissSegment: () => undefined,
    onGrace: setGraceActive,
  }, PLAYER_TIMERS));
  useEffect(() => () => back.destroy(), [back]);
  useBackLayers(trailerBackLayers({ trailer: state, scrubbing, graceActive, panel, chromeShown: shown.chrome }), {
    routeTransient: () => void back.routeBack(),
    closePanel: () => latest.current.closePanel(),
    hideChrome: () => controls.hideOverlay(),
    leave: () => latest.current.leave(),
  });

  /** OK sur une cible, sous la garde du défilement (ouvert, OK le valide). */
  const press = useCallback((key: string) => controls.guarded(() => {
    switch (trailerSelectAction(key, shownRef.current)) {
      case "reveal": return controls.showOverlay();
      case "playPause": return controls.remote.playPause();
      case "openSubtitles": return latest.current.openPanel("subtitles");
      case "openQuality": return latest.current.openPanel("quality");
      case "leave": return latest.current.leave();
      default: return undefined;
    }
  })(), [controls]);

  const onProgress = useCallback((progress: TrailerProgress) => {
    durationRef.current = progress.duration;
    // Pendant un défilement, la position est la cible des contrôles : le moteur ne l'écrase pas.
    if (!scrubbingRef.current) positionRef.current = progress.position;
    setTimeline({ position: progress.position, duration: progress.duration, buffered: progress.buffered });
  }, []);

  const seekFlash = useMemo(
    () => (skipFlash ? { forward: skipFlash.delta >= 0, label: seekFlashLabel(t, skipFlash.delta) } : null),
    [skipFlash, t],
  );

  return {
    paused,
    timeline: timeline && timeline.duration > 0 ? timeline : null,
    chromeShown: shown.chrome,
    timelineShown: shown.timeline,
    scrubTarget: scrubbing ? scrubPosition : null,
    seekFlash,
    press,
    onProgress,
  };
}
