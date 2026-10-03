import { createHoldMotor } from "./holdMotor";
import { holdStillTicking } from "./pressGuards";
import type { PlayerTimers } from "./playerTimers";

/** Le sens d'un déplacement dans la vidéo. */
export type ScrubDir = "forward" | "backward";

/**
 * Les flèches du lecteur, telles que la PLATEFORME les émet. Le geste est le
 * même partout — un appui SAUTE, un maintien DÉFILE — ; seule la façon de les
 * reconnaître change (`apps/tv` : `scrubInput.ts` pour Android TV,
 * `scrubInput.ios.ts` pour Apple TV).
 */
export interface ScrubInputProfile {
  /** Un appui simple ne se tranche qu'au relâchement : son début peut encore
   *  ouvrir un maintien. Sinon, l'événement reçu EST l'appui (déjà tranché). */
  tapOnRelease: boolean;
  /** Le maintien se reconnaît au key-down sans key-up (signal natif peu fiable). */
  holdFromKeyDown: boolean;
  /** Ce qu'on attend encore après le signal d'appui long natif avant d'engager. */
  holdArmMs: number;
  /** La fin du maintien est ANNONCÉE (relâchement de l'appui long) : rien ne
   *  répète entre le début et la fin. Sinon, le silence des répétitions la dit. */
  holdEndAnnounced: boolean;
}

/** Maintien déduit du key-down, défilement déjà ouvert : un key-down sans
 *  key-up au bout de ce délai est un maintien. */
export const HOLD_FROM_DOWN_SCRUB_MS = 400;
/** Idem depuis la lecture (habillage caché) : délai avant d'ENGAGER. */
export const HOLD_FROM_DOWN_ENGAGE_MS = 550;

/** Codes internes du moteur — il ne s'en sert que pour l'égalité. Les touches
 *  média ont les leurs : un maintien de flèche et un maintien d'avance ne
 *  s'enchaînent pas l'un l'autre. */
const CODES: Record<"dpad" | "media", Record<ScrubDir, number>> = {
  dpad: { forward: 1, backward: 2 },
  media: { forward: 3, backward: 4 },
};
const signOf = (dir: ScrubDir): 1 | -1 => (dir === "forward" ? 1 : -1);
const dirOf = (sign: 1 | -1): ScrubDir => (sign === 1 ? "forward" : "backward");

/** Ce que le maintien lit et déclenche chez le lecteur. */
export interface ArrowHoldHost {
  isScrubbing: () => boolean;
  isPanelOpen: () => boolean;
  /** L'habillage tel que le lecteur l'a rendu en dernier. */
  isOverlayVisible: () => boolean;
  /** Un pas SEC du curseur (appui média isolé). */
  stepScrub: (dir: ScrubDir) => void;
  /** Un tic de MAINTIEN — le moteur fournit le palier (1/2/4/8). */
  tickScrub: (dir: ScrubDir, tier: number) => void;
  /** Le maintien s'engage : le défilement s'ouvre, sans attendre le premier tic. */
  onEngage: () => void;
  /** Un appui simple, tranché au relâchement (`requestDeferredTap`). */
  onTap: (dir: ScrubDir) => void;
  /** Fin de maintien. */
  onHoldEnd: () => void;
}

export interface ArrowHold {
  /** Le signal d'appui long natif d'une flèche. */
  handleLongDirection: (dir: ScrubDir) => void;
  /** Un key-down de flèche : arme la détection de maintien autonome. */
  armHoldFromDown: (dir: ScrubDir) => void;
  /** Un appui que le relâchement tranchera. */
  requestDeferredTap: (dir: ScrubDir) => void;
  /** Une touche média (avance, recul) : pas sec isolé, ou tic à la répétition. */
  mediaPulse: (dir: ScrubDir) => void;
  /** Un relâchement (fin de maintien, et sur Apple TV la fin elle-même). */
  onHoldRelease: () => void;
  /** Rupture franche (validation, annulation) : armements et tic tués. */
  stopAll: () => void;
  /** Le tic tient-il encore les appuis directionnels ? */
  isHoldTicking: () => boolean;
  destroy: () => void;
}

/**
 * Le MAINTIEN des flèches et des touches média du lecteur. La mécanique (tic
 * 250 ms, un palier par seconde, chien de garde de silence) est le moteur
 * commun (`holdMotor.ts`, le même que la LG) ; ce qui dépend de la plateforme
 * vient de son profil (`ScrubInputProfile`), jamais d'un nom de plateforme :
 *
 *  - la détection de maintien AUTONOME (key-down sans key-up), doublée du
 *    signal d'appui long natif quand il existe ;
 *  - le délai d'armement après ce signal ;
 *  - la fin du maintien : déduite du silence des répétitions, ou ANNONCÉE par
 *    le relâchement de l'appui long (`motor.hold`) ;
 *  - l'appui simple tranché au key-up quand le down pouvait encore ouvrir un
 *    maintien.
 *
 * Engager un maintien OUVRE le défilement aussitôt (`onEngage`) : la vue paraît
 * sous le doigt, le premier tic ne vient qu'un quart de seconde plus tard.
 * Module pur, minuteurs injectés.
 */
export function createArrowHold(profile: ScrubInputProfile, host: ArrowHoldHost, timers: PlayerTimers): ArrowHold {
  let ticking = false;
  let tickingStoppedAt = 0;
  let lastCode = 0;
  let pendingTap: ScrubDir | null = null;
  let armTimer: unknown = null;
  let downTimer: unknown = null;

  const motor = createHoldMotor({
    jump: (sign) => host.stepScrub(dirOf(sign)),
    advance: (sign, tier) => {
      ticking = true;
      host.tickScrub(dirOf(sign), tier);
    },
    now: timers.now,
  });

  const markTickingStopped = () => {
    if (ticking) tickingStoppedAt = timers.now();
    ticking = false;
  };
  const cancelArm = () => {
    if (armTimer !== null) timers.clearTimeout(armTimer);
    armTimer = null;
  };
  const cancelDown = () => {
    if (downTimer !== null) timers.clearTimeout(downTimer);
    downTimer = null;
  };

  /** Engagement — idempotent : le défilement s'ouvre, le tic part. */
  const engageHold = (dir: ScrubDir) => {
    pendingTap = null;
    ticking = true;
    lastCode = CODES.dpad[dir];
    host.onEngage();
    if (profile.holdEndAnnounced) motor.hold(CODES.dpad[dir], signOf(dir));
    else motor.press(CODES.dpad[dir], signOf(dir), true);
  };

  return {
    handleLongDirection(dir) {
      if (host.isPanelOpen() || host.isOverlayVisible()) return;
      // DÉJÀ en défilement, ou rien à attendre : le maintien accélère tout de suite.
      if (host.isScrubbing() || profile.holdArmMs <= 0) {
        engageHold(dir);
        return;
      }
      cancelArm();
      armTimer = timers.setTimeout(() => {
        armTimer = null;
        engageHold(dir);
      }, profile.holdArmMs);
    },
    armHoldFromDown(dir) {
      cancelDown();
      const delay = host.isScrubbing() ? HOLD_FROM_DOWN_SCRUB_MS : HOLD_FROM_DOWN_ENGAGE_MS;
      downTimer = timers.setTimeout(() => {
        downTimer = null;
        // Relu au déclenchement : panneau ouvert, ou habillage affiché hors
        // défilement = navigation, jamais d'avance rapide.
        if (host.isPanelOpen()) return;
        if (!host.isScrubbing() && host.isOverlayVisible()) return;
        engageHold(dir);
      }, delay);
    },
    requestDeferredTap(dir) {
      pendingTap = dir;
    },
    mediaPulse(dir) {
      lastCode = CODES.media[dir];
      motor.press(CODES.media[dir], signOf(dir), false);
    },
    onHoldRelease() {
      cancelArm();
      cancelDown();
      motor.release(lastCode);
      markTickingStopped();
      host.onHoldEnd();
      const tap = pendingTap;
      pendingTap = null;
      if (tap && !host.isScrubbing() && !host.isPanelOpen()) host.onTap(tap);
    },
    stopAll() {
      cancelArm();
      cancelDown();
      motor.cancel();
      markTickingStopped();
      pendingTap = null;
    },
    isHoldTicking: () => holdStillTicking(ticking, timers.now(), tickingStoppedAt),
    destroy() {
      motor.destroy();
      cancelArm();
      cancelDown();
    },
  };
}
