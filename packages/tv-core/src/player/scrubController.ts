import { createArrowHold, type ArrowHold, type ScrubDir, type ScrubInputProfile } from "./arrowHold";
import type { PlayerTimers } from "./playerTimers";
import { createScrubCountdown, reportingActivity, type ScrubCountdownState } from "./scrubCountdown";
import { createScrubMachine } from "./scrubMachine";
import { jumpSecondsOf } from "./seekTuning";

/** Une reprise automatique sur une cible inchangée n'est qu'une annulation :
 *  aucun seek pour revenir au même endroit. */
export const UNMOVED_SECONDS = 1;

const signOf = (dir: ScrubDir): 1 | -1 => (dir === "forward" ? 1 : -1);

/** Ce que le défilement lit et déclenche chez le lecteur. */
export interface ScrubControllerHost {
  /** La base des sauts (position rapportée, ou dernière cible). */
  readPosition: () => number;
  writePosition: (seconds: number) => void;
  readDuration: () => number;
  /** La lecture est-elle en pause ? Lu à l'entrée : annuler rend cet état. */
  readPaused: () => boolean;
  isPanelOpen: () => boolean;
  /** L'habillage tel que le lecteur l'a rendu en dernier. */
  isOverlayVisible: () => boolean;
  /** Le fond du lecteur tient-il le focus ? (le saut n'appartient qu'à lui) */
  backgroundHoldsFocus: () => boolean;
  /** Rallumer l'habillage (sa minuterie repart). */
  revealOverlay: () => void;
  /** Le rallumer à la SORTIE du défilement (cf. `createPlayerControls`). */
  revealOverlayOnExit: () => void;
  /** Le masquer : la vue du défilement est seule à l'écran. */
  hideOverlay: () => void;
  seek: (seconds: number) => void;
  scrubPause: (paused: boolean) => void;
  /** Un SAUT INSTANTANÉ hors défilement, du saut de son sens. */
  skip: (dir: ScrubDir) => void;
  /** Un appui directionnel a été traité : il ne rallume pas l'habillage. */
  markArrowHandled: () => void;
  onScrubbing: (scrubbing: boolean) => void;
  onPosition: (seconds: number) => void;
  onSpeedLabel: (label: string | null) => void;
  onCountdown: (state: ScrubCountdownState | null) => void;
  debug?: (message: string) => void;
}

export interface ScrubController {
  isScrubbing: () => boolean;
  /** Horodatages des gardes : fin du dernier défilement, ouverture par un
   *  bouton (posée par le lecteur), dernière touche média. */
  readonly marks: { scrubEndedAt: number; scrubStartedAt: number; lastMediaKeyAt: number };
  nudgeScrub: (deltaSeconds: number) => void;
  startScrubbing: (dir?: ScrubDir) => void;
  jump: (dir: ScrubDir) => void;
  confirmScrub: () => void;
  cancelScrub: () => void;
  touchStart: () => void;
  startDrag: () => void;
  endDrag: () => void;
  handleDpadDirection: (dir: ScrubDir) => void;
  handleLongDirection: (dir: ScrubDir) => void;
  onHoldRelease: () => void;
  handleMediaSeekKey: (dir: ScrubDir) => void;
  destroy: () => void;
}

/**
 * Le DÉFILEMENT du lecteur (l'avance rapide) : la machine commune
 * (`scrubMachine.ts`, la même que la LG) SANS abandon sur inactivité — le
 * décompte (`scrubCountdown.ts`) le ferme —, et autour d'elle :
 *
 *  - les gestes, les mêmes sur toutes les plateformes : hors défilement, un
 *    APPUI ←/→ SAUTE aussitôt (+30 s, −10 s) ; un MAINTIEN ouvre le
 *    défilement et accélère (`arrowHold.ts`) ; défilement ouvert, un appui
 *    DÉPLACE LA CIBLE du saut de son sens ; les touches média défilent ;
 *  - la TRAPPE du curseur : le glisser du pavé avance par deltas continus,
 *    l'appui d'un saut fixe, la machine ne connaît que ses pas
 *    proportionnels — la position AFFICHÉE fait donc foi : les pas de la
 *    machine s'y appliquent en DELTAS, et la validation cherche l'affichage ;
 *  - le DÉCOMPTE : entré en lecture, la lecture repart à la cible 5 s après
 *    le dernier geste (cible inchangée : sans seek) ; entré en pause, la cible
 *    attend OK ou Retour.
 *
 * Module pur, minuteurs injectés.
 */
export function createScrubController(
  host: ScrubControllerHost,
  { profile, timers }: { profile: ScrubInputProfile; timers: PlayerTimers },
): ScrubController {
  let scrubbing = false;
  let position = 0;
  let machineLast = 0;
  let origin = 0;
  let enteredPaused = false;
  const marks = { scrubEndedAt: 0, scrubStartedAt: 0, lastMediaKeyAt: 0 };
  let hold: ArrowHold | null = null;
  const stopMotors = () => hold?.stopAll();

  const countdown = createScrubCountdown({ onChange: (state) => host.onCountdown(state), onResume: () => resume(), timers });

  const clampDisplay = (value: number) => {
    const duration = host.readDuration() || 0;
    if (!(duration > 0)) return Math.max(0, value);
    return Math.min(Math.max(0, value), duration);
  };
  const setDisplay = (value: number) => {
    position = value;
    host.onPosition(value);
  };

  const machine = reportingActivity(createScrubMachine({
    readPosition: () => host.readPosition(),
    readDuration: () => host.readDuration() || 0,
    readPaused: () => {
      enteredPaused = host.readPaused();
      return enteredPaused;
    },
    idleCancelMs: null,
    onEnter: (at) => {
      scrubbing = true;
      host.onScrubbing(true);
      machineLast = at;
      origin = at;
      setDisplay(at);
      countdown.begin(enteredPaused);
      host.hideOverlay();
    },
    onChange: (at) => {
      const delta = at - machineLast;
      machineLast = at;
      setDisplay(clampDisplay(position + delta));
    },
    onPause: (pause) => host.scrubPause(pause),
    onSeek: () => {
      // La position AFFICHÉE fait foi ; la base des sauts la reçoit AVANT le
      // seek : un saut aussitôt après ne repart pas d'avant le défilement.
      host.writePosition(position);
      host.seek(position);
    },
    onExit: () => {
      countdown.end();
      stopMotors();
      marks.scrubEndedAt = timers.now();
      scrubbing = false;
      host.onScrubbing(false);
      host.onSpeedLabel(null);
      host.revealOverlayOnExit();
    },
  }), countdown);

  function resume(): void {
    host.debug?.("[SCRUB] reprise automatique");
    stopMotors();
    if (Math.abs(position - origin) < UNMOVED_SECONDS) machine.cancel();
    else machine.confirm();
  }

  const nudgeScrub = (deltaSeconds: number) => {
    machine.touch();
    setDisplay(clampDisplay(position + deltaSeconds));
  };
  /** Un pas SEC : le saut de son sens, jamais d'accélération. */
  const stepScrub = (dir: ScrubDir) => {
    host.onSpeedLabel(null);
    nudgeScrub(jumpSecondsOf(dir));
  };
  const startScrubbing = (dir?: ScrubDir) => {
    // Déjà ouvert (doigt reposé, maintien qui reprend) : la cible reste.
    if (machine.isActive()) {
      machine.touch();
      return;
    }
    machine.enter();
    if (dir) stepScrub(dir);
  };
  const tickScrub = (dir: ScrubDir, tier: number) => {
    machine.step(signOf(dir), tier);
    host.onSpeedLabel(tier > 1 ? `${dir === "forward" ? ">>" : "<<"}${tier}x` : null);
  };
  const jump = (dir: ScrubDir) => {
    if (machine.isActive()) stepScrub(dir);
  };
  /** Un APPUI ←/→ hors défilement : il n'appartient à la vidéo — un saut —
   *  que habillage caché, fond focalisé ; ailleurs il (r)allume l'habillage. */
  const tap = (dir: ScrubDir) => {
    if (host.isPanelOpen() || scrubbing) return;
    if (!host.isOverlayVisible() && host.backgroundHoldsFocus()) host.skip(dir);
    else host.revealOverlay();
  };

  hold = createArrowHold(profile, {
    isScrubbing: () => scrubbing,
    isPanelOpen: host.isPanelOpen,
    isOverlayVisible: host.isOverlayVisible,
    stepScrub,
    tickScrub,
    onEngage: () => {
      startScrubbing();
      countdown.hold();
    },
    onTap: tap,
    onHoldEnd: () => {
      host.onSpeedLabel(null);
      countdown.release();
    },
  }, timers);
  const arrows = hold;

  return {
    isScrubbing: () => scrubbing,
    marks,
    nudgeScrub,
    startScrubbing,
    jump,
    confirmScrub() {
      host.debug?.(`[SCRUB] confirmScrub (scrubbing=${scrubbing})`);
      stopMotors();
      machine.confirm();
    },
    cancelScrub() {
      stopMotors();
      machine.cancel();
    },
    touchStart() {
      if (!scrubbing) return;
      machine.touch();
      countdown.hold();
    },
    startDrag() {
      startScrubbing();
      countdown.hold();
    },
    endDrag() {
      if (!scrubbing) return;
      host.onSpeedLabel(null);
      machine.touch();
      countdown.release();
    },
    handleDpadDirection(dir) {
      if (host.isPanelOpen()) return;
      host.markArrowHandled();
      if (profile.holdFromKeyDown) arrows.armHoldFromDown(dir);
      if (scrubbing) {
        // Maintien en cours (ou relâchement résiduel) : l'avance appartient au tic.
        if (arrows.isHoldTicking()) return;
        jump(dir);
        return;
      }
      if (profile.tapOnRelease) arrows.requestDeferredTap(dir);
      else tap(dir);
    },
    handleLongDirection: arrows.handleLongDirection,
    onHoldRelease: arrows.onHoldRelease,
    handleMediaSeekKey(dir) {
      if (host.isPanelOpen()) return;
      host.markArrowHandled();
      marks.lastMediaKeyAt = timers.now();
      if (scrubbing) {
        arrows.mediaPulse(dir);
        return;
      }
      startScrubbing(dir);
    },
    destroy() {
      countdown.destroy();
      machine.destroy();
      arrows.destroy();
    },
  };
}
