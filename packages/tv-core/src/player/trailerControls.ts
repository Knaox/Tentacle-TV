import type { RemoteTraits } from "../remote/bindings/types";
import type { RemoteIntent } from "../remote/intents";
import type { SignalPhase } from "../remote/signals";
import type { ScrubInputProfile } from "./arrowHold";
import { createPlayerControls, type PlayerControls, type PlayerControlsHost } from "./playerControls";
import { playerRemoteSteps, type PlayerRemoteStep } from "./playerRemote";
import type { PlayerTimers } from "./playerTimers";
import type { ScrubCountdownPolicy } from "./scrubCountdown";
import { TRAILER_CLOSE_KEY, TRAILER_IDLE_MS, type TrailerState } from "./trailerChrome";
import { TRAILER_QUALITY_KEY, TRAILER_SUBTITLES_KEY, TRAILER_TIMELINE_KEY } from "./trailerFocus";
import type { TrailerPanel } from "./trailerPanels";

/**
 * Les CONTRÔLES de la bande-annonce : ceux du grand lecteur
 * (`createPlayerControls`), tels quels — saut −10 / +30 s cumulé et son
 * badge, maintien ←/→ accéléré (paliers ×1 → ×8), défilement et son
 * décompte, touches média, glisser du pavé (`createTouchScrub` sur
 * `readTouchMode`), Lecture/Pause qui bascule et rallume. Seules changent
 * les LECTURES que ces contrôles font de l'écran :
 *
 * - les flèches appartiennent à la vidéo quand la BARRE a le focus — chrome
 *   affiché OU estompé (sur le grand lecteur, seulement habillage caché) :
 *   pour les contrôles, « habillage visible » veut dire « un bouton a le
 *   focus, les flèches naviguent » ;
 * - rien ne se lit hors lecture (chargement, « indisponible ») : comme un
 *   panneau ouvert, les flèches, OK et Lecture/Pause n'y font rien ;
 * - le chrome s'éteint au bout de `TRAILER_IDLE_MS` (3 s), jamais en pause
 *   ni panneau ouvert (`overlayAutoHide.ts`) ;
 * - un saut chrome affiché le garde affiché (la barre montre où l'on va).
 *
 * Module pur, minuteurs injectés.
 */

/** L'écran tel que la plateforme l'a RENDU en dernier. */
export interface TrailerControlsView {
  state: TrailerState;
  /** Le chrome tel que les contrôles l'ont allumé (`onChromeVisible`). */
  chromeVisible: boolean;
  focusedKey: string | null;
  panel: TrailerPanel | null;
}

/** Ce que les contrôles du grand lecteur lisent, déduit de l'écran. */
export function trailerControlsReads(view: TrailerControlsView): {
  panelOpen: boolean;
  overlayVisible: boolean;
  backgroundHoldsFocus: boolean;
} {
  const onTimeline = view.focusedKey === TRAILER_TIMELINE_KEY || view.focusedKey === null;
  return {
    panelOpen: view.panel !== null || view.state !== "playing",
    overlayVisible: view.chromeVisible && !onTimeline,
    backgroundHoldsFocus: onTimeline,
  };
}

export interface TrailerControlsHost
  extends Pick<
    PlayerControlsHost,
    | "readPosition" | "writePosition" | "readDuration" | "readPaused" | "seek" | "playPause" | "scrubPause"
    | "onSkipFlash" | "onScrubbing" | "onPosition" | "onSpeedLabel" | "onCountdown" | "debug"
  > {
  readView: () => TrailerControlsView;
  /** Le chrome s'allume ou s'éteint. */
  onChromeVisible: (visible: boolean) => void;
  /** Quitter l'écran (la croix, le Retour de la page). */
  leave: () => void;
}

export function createTrailerControls(
  host: TrailerControlsHost,
  { profile, timers, readCountdownPolicy }: {
    profile: ScrubInputProfile;
    timers: PlayerTimers;
    /** Le réglage « Avance rapide » de la plateforme, s'il existe ; défaut : celui du grand lecteur. */
    readCountdownPolicy?: () => ScrubCountdownPolicy;
  },
): PlayerControls {
  const reads = () => trailerControlsReads(host.readView());
  let controls: PlayerControls | null = null;
  controls = createPlayerControls({
    readPosition: host.readPosition,
    writePosition: host.writePosition,
    readDuration: host.readDuration,
    readPaused: host.readPaused,
    isPanelOpen: () => reads().panelOpen,
    isOverlayVisible: () => reads().overlayVisible,
    backgroundHoldsFocus: () => reads().backgroundHoldsFocus,
    seek: host.seek,
    back: host.leave,
    playPause: host.playPause,
    scrubPause: host.scrubPause,
    onOverlayVisible: host.onChromeVisible,
    onSkipFlash: (state) => {
      host.onSkipFlash(state);
      if (state && host.readView().chromeVisible) controls?.showOverlay();
    },
    onScrubbing: host.onScrubbing,
    onPosition: host.onPosition,
    onSpeedLabel: host.onSpeedLabel,
    onCountdown: host.onCountdown,
    debug: host.debug,
  }, { profile, timers, initialPanelOpen: false, readCountdownPolicy, overlayHideMs: TRAILER_IDLE_MS });
  return controls;
}

/**
 * Les gestes d'une intention sur la bande-annonce : ceux du grand lecteur
 * (`playerRemoteSteps`), à une exception près. OK sur la BARRE n'est servi
 * que par son appui (`trailerSelectAction`) : l'événement global n'y
 * rallume pas le chrome — l'appui de l'élément et l'événement global
 * arrivent dans un ordre indéterminé (`pressGuards.ts`), et un chrome
 * rallumé d'abord ferait du premier OK une pause.
 */
export function trailerRemoteSteps(
  intent: RemoteIntent,
  traits: Pick<RemoteTraits, "pressOnRelease">,
  phase: SignalPhase | null,
  focusedKey: string | null,
): PlayerRemoteStep[] {
  const steps = playerRemoteSteps(intent, traits, phase);
  if (intent.type !== "select" || focusedKey !== TRAILER_TIMELINE_KEY) return steps;
  return steps.filter((step) => step.kind !== "anyPress");
}

export type TrailerSelectAction = "reveal" | "playPause" | "openSubtitles" | "openQuality" | "leave" | "none";

/**
 * OK sur une cible (son appui, sous la garde `controls.guarded` : défilement
 * ouvert, OK le valide). La barre : chrome estompé, montrer ; affiché, la
 * pause — « OK puis OK », sur les deux plateformes. `chromeShown` : le
 * chrome tel qu'il était RENDU à l'appui.
 */
export function trailerSelectAction(key: string, chromeShown: boolean): TrailerSelectAction {
  switch (key) {
    case TRAILER_TIMELINE_KEY: return chromeShown ? "playPause" : "reveal";
    case TRAILER_CLOSE_KEY: return "leave";
    case TRAILER_SUBTITLES_KEY: return "openSubtitles";
    case TRAILER_QUALITY_KEY: return "openQuality";
    default: return "none";
  }
}
