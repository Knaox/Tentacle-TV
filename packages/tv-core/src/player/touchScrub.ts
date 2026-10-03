import type { DragPhase } from "../remote/intents";
import type { PlayerTimers } from "./playerTimers";
import { canEngage, scrubGainFor, type TouchMode } from "./scrubTouchTuning";

/** Un glisser que la plateforme ANNULE n'émet aucune fin : sans nouvelle
 *  depuis ce délai, le geste est clos (le défilement, lui, reste ouvert). Un
 *  doigt resté posé qui repart ensuite reprend un geste là où il en est. */
export const SILENT_END_MS = 450;
/** Le curseur suit le doigt, mais l'affichage ne se redessine qu'à ce rythme
 *  (~30 i/s) : chaque position redessine l'écran du lecteur. */
export const FLUSH_MS = 33;

/** Ce que le glisser déclenche chez le lecteur. */
export interface TouchScrubHandlers {
  /** Le régime du geste, lu quand le doigt se pose. */
  readTouchMode: () => TouchMode;
  /** Le doigt se pose (ou repart après un silence). */
  onTouchStart: () => void;
  /** Le glisser franchit son seuil : le défilement s'ouvre (ou reprend). */
  onStartScrub: () => void;
  /** Le doigt emporte le curseur : delta signé, en secondes de vidéo. */
  onNudgeScrub: (deltaSeconds: number) => void;
  /** Le doigt se lève ou s'immobilise (le défilement reste ouvert). */
  onEndScrub: () => void;
  /** Un simple toucher, sans glisser engagé. */
  onWake: () => void;
  /** La durée de la vidéo : tant qu'elle est inconnue, rien ne défile. */
  readDuration: () => number;
}

export interface TouchScrub {
  /** Un `drag` de la télécommande : phase, translation depuis la pose, vitesse horizontale. */
  drag: (phase: DragPhase, x: number, y: number, vx: number) => void;
  /** Coupé (panneau ouvert) : le geste en cours n'a plus de suite. */
  reset: () => void;
  destroy: () => void;
}

/**
 * Le défilement au pavé tactile, en MANIPULATION DIRECTE, comme le lecteur
 * d'Apple : le doigt qui glisse emporte le curseur (un glisser à droite
 * avance), finement si l'on est lent, plus largement si l'on est vif, sans
 * dépasser le plafond (`scrubTouchTuning.ts`). Le doigt levé, le défilement
 * reste ouvert : OK lit depuis la cible, Retour revient où l'on était, un
 * nouveau glisser reprend d'où le curseur en est. Un simple toucher réveille
 * l'habillage.
 *
 * Trois régimes, lus quand le doigt se pose (`canEngage`) : habillage CACHÉ,
 * le glisser ne défile qu'après un contact tenu ; habillage AFFICHÉ, passée la
 * zone morte ; défilement déjà OUVERT, au premier pas. Module pur, minuteurs
 * injectés.
 */
export function createTouchScrub(handlers: TouchScrubHandlers, timers: PlayerTimers): TouchScrub {
  const s = {
    /** Un geste suivi (posé, ou repris après un silence). */
    active: false,
    engaged: false,
    /** Le doigt touche : un début sans fin — le silence n'y change rien. */
    touching: false,
    mode: "shown" as TouchMode,
    /** La pose du doigt : le contact tenu se compte d'ici. */
    beganAt: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    pending: 0,
    flush: null as unknown,
    silence: null as unknown,
  };

  const flushNow = () => {
    if (s.flush !== null) {
      timers.clearTimeout(s.flush);
      s.flush = null;
    }
    if (s.pending !== 0) {
      const delta = s.pending;
      s.pending = 0;
      handlers.onNudgeScrub(delta);
    }
  };

  /** La fin du geste — relâchement, ou silence d'un geste annulé (ou d'un doigt immobile). */
  const finish = () => {
    if (s.silence !== null) {
      timers.clearTimeout(s.silence);
      s.silence = null;
    }
    if (!s.active) return;
    flushNow();
    s.active = false;
    if (s.engaged) handlers.onEndScrub();
    else handlers.onWake();
    s.engaged = false;
  };

  const armSilence = () => {
    if (s.silence !== null) timers.clearTimeout(s.silence);
    s.silence = timers.setTimeout(finish, SILENT_END_MS);
  };

  /** Un geste commence ici, sans rattraper la course d'avant. Le contact, lui,
   *  court depuis la pose. */
  const track = (x: number, y: number, contactSince: number) => {
    Object.assign(s, {
      active: true, engaged: false, mode: handlers.readTouchMode(),
      beganAt: contactSince, originX: x, originY: y, lastX: x, pending: 0,
    });
    handlers.onTouchStart();
  };

  const clearTimers = () => {
    if (s.silence !== null) timers.clearTimeout(s.silence);
    if (s.flush !== null) timers.clearTimeout(s.flush);
  };

  return {
    drag(phase, x, y, vx) {
      if (phase === "start") {
        finish(); // un geste précédent annulé sans fin
        s.touching = true;
        track(x, y, timers.now());
        armSilence();
        return;
      }
      if (phase === "end") {
        finish();
        s.touching = false;
        return;
      }
      // Un mouvement hors geste : le doigt repart après un silence, ou glissait
      // déjà quand le glisser a été pris (son contact se compte alors d'ici).
      if (!s.active) track(x, y, s.touching ? s.beganAt : timers.now());
      armSilence();
      if (!s.engaged) {
        if (!((handlers.readDuration() || 0) > 0)) return;
        if (!canEngage(s.mode, x - s.originX, y - s.originY, timers.now() - s.beganAt)) return;
        s.engaged = true;
        s.lastX = x; // le curseur part d'ici : la zone morte ne déplace rien
        handlers.onStartScrub();
        return;
      }
      const step = x - s.lastX;
      s.lastX = x;
      if (step === 0) return;
      s.pending += step * scrubGainFor(Math.abs(vx));
      if (s.flush === null) s.flush = timers.setTimeout(flushNow, FLUSH_MS);
    },
    reset() {
      clearTimers();
      Object.assign(s, { active: false, engaged: false, touching: false, pending: 0, flush: null, silence: null });
    },
    destroy: clearTimers,
  };
}
