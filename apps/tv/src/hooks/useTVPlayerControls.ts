import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPlayerControls, RESUME_COUNTDOWN_POLICY,
  type ScrubCountdownPolicy, type ScrubCountdownState, type SkipFlashState,
} from "@tentacle-tv/tv-core";
import { backgroundHoldsFocus } from "../components/player/focus/osdFocusBus";
import { PLAYER_TIMERS } from "./playerTimers";
import { SCRUB_INPUT } from "./scrubInput";
import { usePlayerRemoteBinding } from "./usePlayerRemoteBinding";
import { useScrubGestures } from "./useScrubGestures";

interface TVPlayerControlsOptions {
  paused: boolean;
  jellyfinDuration: number;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onPlayPause: () => void;
  /** Pause la lecture à l'entrée en mode scrub, reprend à la sortie. */
  onScrubPause: (paused: boolean) => void;
  /** Panneau au-dessus du lecteur (paramètres, épisodes) : suspend l'auto-hide
   *  ET neutralise les events D-pad du lecteur (sinon ←/→ scrubbent la lecture
   *  pendant qu'on navigue dans le panneau). */
  panelOpen?: boolean;
  /** Base position/skips PARTAGÉE avec les hooks de seek (possédée par PlayerScreen) :
   *  les commits de seek la synchronisent directement — un +30 enchaîné part toujours
   *  de la dernière cible, jamais d'un progress périmé. Défaut : ref interne. */
  currentTimeRef?: React.MutableRefObject<number>;
  /** Ce que fait le décompte du défilement, et quand — le réglage « Avance
   *  rapide » (Apple TV, `useScrubCountdownPolicy`). Absent : la politique
   *  d'avant (`RESUME_COUNTDOWN_POLICY`), que garde Android TV. Lue à chaque
   *  ouverture du défilement. */
  countdownPolicy?: ScrubCountdownPolicy;
}

/**
 * Les contrôles télécommande du lecteur, en état React — Apple TV et Android
 * TV. Tout ce qui DÉCIDE est dans tv-core (`player/playerControls.ts` : saut
 * instantané et badge, avance rapide et son décompte, maintien, gardes,
 * extinction de l'habillage ; la table des intentions, `playerRemote.ts`).
 * Ce crochet tient les miroirs (pause, panneau, habillage tels que rendus),
 * l'état que l'écran lit, et branche les entrées : la télécommande par sa
 * couture (`usePlayerRemoteBinding` : l'entrée unique sur Apple TV,
 * `useTVRemote` sur Android TV) et le pavé (`useScrubGestures`).
 */
export function useTVPlayerControls({
  paused, jellyfinDuration, onSeek, onBack, onPlayPause, onScrubPause,
  panelOpen = false, currentTimeRef: externalTimeRef, countdownPolicy,
}: TVPlayerControlsOptions) {
  const internalTimeRef = useRef(0);
  const currentTimeRef = externalTimeRef ?? internalTimeRef;
  // Les miroirs du DERNIER rendu : ce que les contrôles lisent au geste.
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const durationRef = useRef(jellyfinDuration);
  durationRef.current = jellyfinDuration;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const policyRef = useRef(countdownPolicy);
  policyRef.current = countdownPolicy;
  const latest = useRef({ onSeek, onBack, onPlayPause, onScrubPause });
  latest.current = { onSeek, onBack, onPlayPause, onScrubPause };

  const [overlayVisible, setOverlayVisible] = useState(true);
  const overlayVisibleRef = useRef(true);
  overlayVisibleRef.current = overlayVisible;
  const [skipFlash, setSkipFlash] = useState<SkipFlashState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const [scrubCountdown, setScrubCountdown] = useState<ScrubCountdownState | null>(null);

  const [core] = useState(() => createPlayerControls({
    readPosition: () => currentTimeRef.current,
    writePosition: (seconds) => { currentTimeRef.current = seconds; },
    readDuration: () => durationRef.current,
    readPaused: () => pausedRef.current,
    isPanelOpen: () => panelOpenRef.current,
    isOverlayVisible: () => overlayVisibleRef.current,
    backgroundHoldsFocus,
    seek: (seconds) => latest.current.onSeek(seconds),
    back: () => latest.current.onBack(),
    playPause: () => latest.current.onPlayPause(),
    scrubPause: (pause) => latest.current.onScrubPause(pause),
    onOverlayVisible: setOverlayVisible,
    onSkipFlash: setSkipFlash,
    onScrubbing: setScrubbing,
    onPosition: setScrubPosition,
    onSpeedLabel: setSpeedLabel,
    onCountdown: setScrubCountdown,
    debug: __DEV__ ? (message) => console.log(message) : undefined,
  }, {
    profile: SCRUB_INPUT, timers: PLAYER_TIMERS, initialPanelOpen: panelOpen,
    readCountdownPolicy: () => policyRef.current ?? RESUME_COUNTDOWN_POLICY,
  }));
  useEffect(() => () => core.destroy(), [core]);

  // Change d'identité avec le panneau, comme avant (des effets en dépendent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const showOverlay = useCallback(() => core.showOverlay(), [core, panelOpen]);
  const hideOverlay = useCallback(() => core.hideOverlay(), [core]);

  // L'habillage se rallume aux transitions de lecture/pause et de panneau —
  // sauf celle que provoque le défilement lui-même.
  useEffect(() => {
    core.syncOverlay();
    return () => core.cancelHideTimer();
  }, [core, paused, panelOpen]);

  const handleSkipForward = useCallback(() => core.skipOrJump("forward"), [core]);
  const handleSkipBack = useCallback(() => core.skipOrJump("backward"), [core]);

  // Le pavé tactile (Apple TV ; rien sur Android TV, sans pavé) : partout où
  // la vidéo est le sujet, en lecture comme en pause. Les panneaux (épisodes,
  // pistes, fin) gardent le pavé pour leurs listes.
  useScrubGestures({
    enabled: !panelOpen,
    readTouchMode: core.readTouchMode,
    onTouchStart: core.scrub.touchStart,
    onStartScrub: core.scrub.startDrag,
    onNudgeScrub: core.scrub.nudgeScrub,
    onEndScrub: core.scrub.endDrag,
    onWake: core.wakeFromTouch,
    durationRef,
  });
  usePlayerRemoteBinding(core.remote);

  return {
    currentTimeRef,
    overlayVisible,
    showOverlay,
    hideOverlay,
    speedLabel,
    scrubbing,
    scrubPosition,
    /** Quand le défilement se fermera seul, et pour quoi (`scrubCountdown.ts`). */
    scrubCountdown,
    skipFlash,
    confirmScrub: core.scrub.confirmScrub,
    cancelScrub: core.scrub.cancelScrub,
    /** Garde des boutons de l'habillage : en défilement, OK le valide. */
    guardScrub: <T extends unknown[]>(fn: (...args: T) => void) => core.guarded(fn),
    handleSkipForward,
    handleSkipBack,
    enterScrub: core.enterScrub,
  };
}
