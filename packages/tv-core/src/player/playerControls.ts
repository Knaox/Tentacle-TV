import type { ScrubDir, ScrubInputProfile } from "./arrowHold";
import { createOverlayAutoHide } from "./overlayAutoHide";
import type { PlayerTimers } from "./playerTimers";
import { isScrubTwinPress, scrubConfirmable, touchFollowsPress } from "./pressGuards";
import { createScrubController, type ScrubController } from "./scrubController";
import type { ScrubCountdownPolicy, ScrubCountdownState } from "./scrubCountdown";
import type { TouchMode } from "./scrubTouchTuning";
import { jumpSecondsOf } from "./seekTuning";
import { createSkipFlash, type SkipFlashState } from "./skipFlash";

/** Ce que les contrôles lisent chez le lecteur et lui demandent. Les
 *  lectures rendent l'état du DERNIER rendu (pause, panneau, habillage). */
export interface PlayerControlsHost {
  readPosition: () => number;
  writePosition: (seconds: number) => void;
  readDuration: () => number;
  readPaused: () => boolean;
  /** Un panneau tient la télécommande (réglages, épisodes, affiche de fin). */
  isPanelOpen: () => boolean;
  isOverlayVisible: () => boolean;
  backgroundHoldsFocus: () => boolean;
  /** Un bouton qui attend OK tient le focus (la pilule « Passer ») : le pavé
   *  est tenu (`TouchMode` « held »). */
  skipHoldsFocus?: () => boolean;
  seek: (seconds: number) => void;
  /** Retour, une fois les états passagers servis (Android : BackHandler). */
  back: () => void;
  playPause: () => void;
  scrubPause: (paused: boolean) => void;
  onOverlayVisible: (visible: boolean) => void;
  onSkipFlash: (state: SkipFlashState | null) => void;
  onScrubbing: (scrubbing: boolean) => void;
  onPosition: (seconds: number) => void;
  onSpeedLabel: (label: string | null) => void;
  onCountdown: (state: ScrubCountdownState | null) => void;
  debug?: (message: string) => void;
}

/** Les gestes de la télécommande, tels que le lecteur les reçoit (la table
 *  `playerRemote.ts` y mène chaque intention). */
export interface PlayerRemoteHandlers {
  back: () => void;
  playPause: () => void;
  arrow: (dir: ScrubDir) => void;
  arrowHold: (dir: ScrubDir) => void;
  mediaSeek: (dir: ScrubDir) => void;
  /** Un relâchement : horodaté, et fin de maintien. */
  release: () => void;
  /** HAUT ou BAS. */
  vertical: () => void;
  select: () => void;
  /** Tout appui (flèche, OK, touche média) : horodaté, et rallume. */
  anyPress: () => void;
}

export interface PlayerControls {
  scrub: ScrubController;
  remote: PlayerRemoteHandlers;
  isScrubbing: () => boolean;
  /** Rallume l'habillage — muet pendant le défilement (sa vue y est seule). */
  showOverlay: () => void;
  hideOverlay: () => void;
  /** La pause ou le panneau a changé : l'habillage se rallume (hors défilement). */
  syncOverlay: () => void;
  cancelHideTimer: () => void;
  /** Un bouton de saut de l'habillage : saut instantané, ou cible qui bouge. */
  skipOrJump: (dir: ScrubDir) => void;
  /** Le bouton ⏩ : le défilement s'ouvre, sans bouger. */
  enterScrub: () => void;
  /** La garde des boutons de l'habillage (cf. `guarded`). */
  guarded: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
  /** Un simple toucher du pavé. */
  wakeFromTouch: () => void;
  /** Le régime d'un glisser qui commence. */
  readTouchMode: () => TouchMode;
  /** L'heure du dernier appui (0 : aucun) — le pavé en déduit les clics. */
  readLastPressAt: () => number;
  destroy: () => void;
}

/**
 * Les CONTRÔLES du lecteur TV — le modèle du lecteur d'Apple, celui que
 * Netflix a longtemps été sur Apple TV. Deux gestes distincts :
 *
 * - le SAUT, instantané : habillage caché, un APPUI ←/→ saute de son sens
 *   (+30 s, −10 s, `seekTuning.ts`), exactement comme les boutons de saut de
 *   l'habillage ; la lecture continue (ou reste en pause), les appuis
 *   rapprochés se cumulent depuis la dernière cible, le badge le dit ;
 * - l'AVANCE RAPIDE, le défilement : bouton ⏩, MAINTIEN ←/→, glisser au
 *   pavé (`scrubController.ts`).
 *
 * Habillage visible, ←/→ naviguent. Autour : l'extinction de l'habillage
 * (5 s), les gardes des appuis jumeaux (`pressGuards.ts`). Le même cerveau
 * sert Apple TV et Android TV ; seul le profil des flèches change.
 *
 * `readCountdownPolicy` : ce que fait le décompte du défilement, et quand —
 * le réglage « Avance rapide » de l'Apple TV ; sans lui, la politique d'avant
 * (`RESUME_COUNTDOWN_POLICY`), que garde Android TV.
 *
 * `initialPanelOpen` : la sortie du défilement rallume l'habillage avec l'état
 * du panneau au PREMIER rendu du lecteur — la fermeture que la machine du
 * défilement gardait (constat 8 de `docs/tv-navigation/lecteur.md`, repris tel
 * quel). Module pur, minuteurs injectés.
 */
export function createPlayerControls(
  host: PlayerControlsHost,
  { profile, timers, initialPanelOpen, readCountdownPolicy }: {
    profile: ScrubInputProfile;
    timers: PlayerTimers;
    initialPanelOpen: boolean;
    readCountdownPolicy?: () => ScrubCountdownPolicy;
  },
): PlayerControls {
  let lastPressAt = 0;
  /** Un appui directionnel déjà servi ne rallume pas l'habillage (`anyPress`). */
  let skipAnyPress = false;

  const autoHide = createOverlayAutoHide({ onVisible: host.onOverlayVisible, timers });
  const revealOverlay = () => autoHide.reveal({ paused: host.readPaused(), panelOpen: host.isPanelOpen() });
  const badge = createSkipFlash({ onChange: host.onSkipFlash, timers });

  /** La lecture va aussitôt à la base + le saut ; la base se cumule. */
  const skipBy = (delta: number) => {
    const duration = host.readDuration() || 0;
    const target = host.readPosition() + delta;
    const clamped = Math.max(0, duration > 0 ? Math.min(target, duration) : target);
    host.writePosition(clamped);
    host.seek(clamped);
    badge.flash(delta);
  };

  const scrub = createScrubController({
    readPosition: host.readPosition,
    writePosition: host.writePosition,
    readDuration: host.readDuration,
    readPaused: host.readPaused,
    isPanelOpen: host.isPanelOpen,
    isOverlayVisible: host.isOverlayVisible,
    backgroundHoldsFocus: host.backgroundHoldsFocus,
    revealOverlay,
    revealOverlayOnExit: () => autoHide.reveal({ paused: host.readPaused(), panelOpen: initialPanelOpen }),
    hideOverlay: autoHide.hide,
    seek: host.seek,
    scrubPause: host.scrubPause,
    skip: (dir) => skipBy(jumpSecondsOf(dir)),
    markArrowHandled: () => {
      skipAnyPress = true;
    },
    onScrubbing: host.onScrubbing,
    onPosition: host.onPosition,
    onSpeedLabel: host.onSpeedLabel,
    onCountdown: host.onCountdown,
    debug: host.debug,
  }, { profile, timers, readCountdownPolicy });

  const showOverlay = () => {
    if (!scrub.isScrubbing()) revealOverlay();
  };
  /** OK ou Lecture/Pause, défilement ouvert : valide — sauf écho et jumeau. */
  const confirmIfDue = () => {
    if (scrubConfirmable(timers.now(), scrub.marks)) scrub.confirmScrub();
  };

  return {
    scrub,
    isScrubbing: scrub.isScrubbing,
    showOverlay,
    hideOverlay: autoHide.hide,
    syncOverlay: showOverlay,
    cancelHideTimer: autoHide.cancelTimer,
    skipOrJump(dir) {
      if (scrub.isScrubbing()) scrub.jump(dir);
      else skipBy(jumpSecondsOf(dir));
    },
    enterScrub() {
      // Ouvert sous un appui sur OK : son « select » jumeau ne le valide pas.
      scrub.marks.scrubStartedAt = timers.now();
      scrub.startScrubbing();
    },
    guarded: (fn) => (...args) => {
      // Défilement ouvert : OK valide le défilement, jamais l'action du bouton.
      if (scrub.isScrubbing()) {
        scrub.confirmScrub();
        return;
      }
      // Le jumeau de l'OK qui vient de le fermer est avalé.
      if (isScrubTwinPress(timers.now(), scrub.marks.scrubEndedAt)) return;
      fn(...args);
    },
    wakeFromTouch() {
      // En défilement, un toucher est un geste : le décompte repart.
      if (scrub.isScrubbing()) {
        scrub.endDrag();
        return;
      }
      if (touchFollowsPress(timers.now(), lastPressAt)) return;
      showOverlay();
    },
    readTouchMode() {
      if (scrub.isScrubbing()) return "open";
      if (host.skipHoldsFocus?.()) return "held";
      return host.isOverlayVisible() ? "shown" : "hidden";
    },
    readLastPressAt: () => lastPressAt,
    remote: {
      back() {
        if (host.isPanelOpen()) return;
        if (scrub.isScrubbing()) {
          scrub.cancelScrub();
          return;
        }
        host.back();
      },
      playPause() {
        if (host.isPanelOpen()) return;
        if (scrub.isScrubbing()) {
          confirmIfDue();
          return;
        }
        // La bascule, et l'habillage — même caché.
        host.playPause();
        showOverlay();
      },
      arrow: (dir) => scrub.handleDpadDirection(dir),
      arrowHold: (dir) => scrub.handleLongDirection(dir),
      mediaSeek: (dir) => scrub.handleMediaSeekKey(dir),
      release() {
        lastPressAt = timers.now();
        scrub.onHoldRelease();
      },
      vertical() {
        if (!scrub.isScrubbing() && !host.isPanelOpen()) showOverlay();
      },
      select() {
        if (host.isPanelOpen()) return;
        if (scrub.isScrubbing()) confirmIfDue();
      },
      anyPress() {
        lastPressAt = timers.now();
        if (skipAnyPress) {
          skipAnyPress = false;
          return;
        }
        if (scrub.isScrubbing() || host.isPanelOpen()) return;
        showOverlay();
      },
    },
    destroy() {
      autoHide.destroy();
      badge.destroy();
      scrub.destroy();
    },
  };
}
