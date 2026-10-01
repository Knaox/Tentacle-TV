import { useEffect, useRef } from "react";
import { usePanGesture } from "../lib/tvPanGesture";
import type { ScrubGestureHandlers } from "./scrubGestureTypes";
import { canEngage, scrubGainFor, type TouchMode } from "./scrubTouchTuning";

export type { ScrubGestureHandlers, ScrubDir } from "./scrubGestureTypes";

// react-native-tvos expose useTVEventHandler ; on passe par require (comme
// useTVRemote) pour éviter les frictions de typage du module.
const { useTVEventHandler } = require("react-native") as {
  useTVEventHandler: (cb: (e: HWEvent) => void) => void;
};

interface HWEvent {
  eventType: string;
  body?: { state: "Began" | "Changed" | "Ended"; x: number; y: number; velocityX: number; velocityY: number };
}

/** Un pan que tvOS ANNULE n'émet aucune fin : sans nouvelle depuis ce délai,
 *  le geste est clos (le défilement, lui, reste ouvert). Un doigt resté posé
 *  qui repart ensuite reprend un geste là où il en est. */
const SILENT_END_MS = 450;
/** Le curseur suit le doigt, mais l'affichage ne se redessine qu'à ce rythme
 *  (~30 i/s) : chaque position redessine l'écran du lecteur. */
const FLUSH_MS = 33;

/**
 * Le défilement au pavé tactile — variante **Apple TV (tvOS)**, en
 * MANIPULATION DIRECTE, comme le lecteur d'Apple : le doigt qui glisse emporte
 * le curseur fantôme (un glisser à droite avance), finement si l'on est lent,
 * plus largement si l'on est vif, sans jamais dépasser le plafond
 * (`scrubTouchTuning.ts`, les gains). Le doigt levé, le défilement reste ouvert : OK lit
 * depuis la position visée, Retour revient où l'on était, un nouveau glisser
 * reprend d'où le curseur en est. Un simple toucher réveille l'habillage.
 *
 * Trois régimes, lus quand le doigt se pose (`readTouchMode`, `canEngage`) :
 * habillage CACHÉ, le glisser ne défile qu'après un contact tenu — un
 * frôlement ne bouge jamais la lecture ; habillage AFFICHÉ (ou pause),
 * aussitôt passée la zone morte ; défilement déjà OUVERT, le doigt revient
 * viser et reprend au premier pas.
 *
 * Remplace la « navette » (la DISTANCE du doigt réglait une vitesse, que le
 * curseur gardait tant qu'on ne bougeait plus) : déroutante, elle ne laissait
 * pas viser. Le pan se prend au compteur (`usePanGesture`) : la vue racine n'en
 * a qu'un, que d'autres écrans tiennent aussi.
 */
export function useScrubGestures({
  enabled, readTouchMode, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake, durationRef,
}: ScrubGestureHandlers): void {
  // Callbacks à jour sans recréer le handler natif.
  const cbRef = useRef({ readTouchMode, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake });
  cbRef.current = { readTouchMode, onTouchStart, onStartScrub, onNudgeScrub, onEndScrub, onWake };
  usePanGesture(enabled);

  const g = useRef({
    /** Un geste suivi (posé, ou repris après un silence). */
    active: false,
    engaged: false,
    /** Le doigt touche : un « Began » sans « Ended » — le silence n'y change rien. */
    touching: false,
    mode: "shown" as TouchMode,
    /** La pose du doigt : le contact tenu se compte d'ici. */
    beganAt: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    pending: 0,
    flush: null as ReturnType<typeof setTimeout> | null,
    silence: null as ReturnType<typeof setTimeout> | null,
  });

  const flushNow = () => {
    const s = g.current;
    if (s.flush) { clearTimeout(s.flush); s.flush = null; }
    if (s.pending !== 0) {
      const delta = s.pending;
      s.pending = 0;
      cbRef.current.onNudgeScrub(delta);
    }
  };

  /** La fin du geste — relâchement, ou silence d'un pan annulé (ou d'un doigt immobile). */
  const finish = () => {
    const s = g.current;
    if (s.silence) { clearTimeout(s.silence); s.silence = null; }
    if (!s.active) return;
    flushNow();
    s.active = false;
    if (s.engaged) cbRef.current.onEndScrub();
    else cbRef.current.onWake();
    s.engaged = false;
  };

  const armSilence = () => {
    const s = g.current;
    if (s.silence) clearTimeout(s.silence);
    s.silence = setTimeout(finish, SILENT_END_MS);
  };

  /** Un geste commence ici : le doigt se pose, ou repart après un silence —
   *  sans rattraper la course d'avant. Le contact, lui, court depuis la pose. */
  const track = (x: number, y: number, contactSince: number) => {
    Object.assign(g.current, {
      active: true, engaged: false, mode: cbRef.current.readTouchMode(),
      beganAt: contactSince, originX: x, originY: y, lastX: x, pending: 0,
    });
    cbRef.current.onTouchStart();
  };

  // Coupé (panneau ouvert, démontage) : le geste en cours n'a plus de suite.
  useEffect(() => {
    if (enabled) return undefined;
    const s = g.current;
    if (s.silence) clearTimeout(s.silence);
    if (s.flush) clearTimeout(s.flush);
    Object.assign(s, { active: false, engaged: false, touching: false, pending: 0, flush: null, silence: null });
    return undefined;
  }, [enabled]);
  useEffect(() => () => {
    const s = g.current;
    if (s.silence) clearTimeout(s.silence);
    if (s.flush) clearTimeout(s.flush);
  }, []);

  useTVEventHandler((evt: HWEvent) => {
    if (!enabled || evt.eventType !== "pan" || !evt.body) return;
    const { state, x, y, velocityX } = evt.body;
    const s = g.current;
    if (state === "Began") {
      finish(); // un geste précédent annulé sans fin
      s.touching = true;
      track(x, y, Date.now());
      armSilence();
      return;
    }
    if (state === "Ended") {
      finish();
      s.touching = false;
      return;
    }
    // Un mouvement hors geste : le doigt repart après un silence, ou glissait
    // déjà quand on a pris le pan (son contact se compte alors d'ici).
    if (!s.active) track(x, y, s.touching ? s.beganAt : Date.now());
    armSilence();
    if (!s.engaged) {
      if (!((durationRef.current || 0) > 0)) return;
      if (!canEngage(s.mode, x - s.originX, y - s.originY, Date.now() - s.beganAt)) return;
      s.engaged = true;
      s.lastX = x; // le curseur part d'ici : la zone morte ne déplace rien
      cbRef.current.onStartScrub();
      return;
    }
    const step = x - s.lastX;
    s.lastX = x;
    if (step === 0) return;
    s.pending += step * scrubGainFor(Math.abs(velocityX));
    if (!s.flush) s.flush = setTimeout(flushNow, FLUSH_MS);
  });
}
