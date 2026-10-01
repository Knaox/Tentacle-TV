import { useEffect, useRef } from "react";
import { usePanGesture } from "../lib/tvPanGesture";
import type { ScrubGestureHandlers } from "./scrubGestureTypes";

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

/** Le glisser n'engage qu'au-delà de cette course HORIZONTALE (points du
 *  pavé) : saisir la télécommande fait souvent glisser le pouce de 30-40 pts. */
const ENGAGE_PX = 60;
/** …et s'il est franchement horizontal : un glisser vertical ne défile pas. */
const HORIZONTAL_RATIO = 1.4;
/** …et après ce délai depuis la pose du doigt — sauf geste franc
 *  (`FLICK_PX`) : un effleurement en prenant la télécommande ne défile pas. */
const ENGAGE_DELAY_MS = 180;
const FLICK_PX = 180;
/** Un pan que tvOS ANNULE n'émet aucune fin : sans nouvelle depuis ce délai,
 *  le geste est clos (le défilement, lui, reste ouvert). */
const SILENT_END_MS = 450;
/** Le curseur suit le doigt, mais l'affichage ne se redessine qu'à ce rythme
 *  (~30 i/s) : chaque position redessine l'écran du lecteur. */
const FLUSH_MS = 33;

/**
 * Secondes par point de pavé — l'accélération d'un pointeur, appliquée au
 * temps : FINE quand le doigt est lent (viser une scène, à la seconde près
 * sur un épisode), LARGE quand il est vif (traverser). Bornes proportionnelles
 * à la durée : vif, un glisser de toute la surface traverse la vidéo ; lent,
 * il en parcourt quelques minutes. Réglage d'appareil : les constantes se
 * reprennent à la Siri Remote réelle.
 */
export function scrubGainFor(speed: number, duration: number): number {
  const fine = Math.min(0.5, Math.max(0.05, duration / 6000));
  const coarse = Math.max(fine, duration / 1500);
  const t = Math.min(1, Math.max(0, (speed - 300) / 1700));
  return fine + (coarse - fine) * t * t * (3 - 2 * t);
}

/**
 * Le défilement au pavé tactile — variante **Apple TV (tvOS)**, en
 * MANIPULATION DIRECTE, comme le lecteur d'Apple : le doigt qui glisse emporte
 * le curseur fantôme (un glisser à droite avance), finement si l'on est lent,
 * largement si l'on est vif. Le doigt levé, le défilement reste ouvert : OK lit
 * depuis la position visée, Retour revient où l'on était, un nouveau glisser
 * reprend d'où le curseur en est. Un simple toucher réveille l'habillage.
 *
 * Remplace la « navette » (la DISTANCE du doigt réglait une vitesse, que le
 * curseur gardait tant qu'on ne bougeait plus) : déroutante, elle ne laissait
 * pas viser. Le pan se prend au compteur (`usePanGesture`) : la vue racine n'en
 * a qu'un, que d'autres écrans tiennent aussi.
 */
export function useScrubGestures({
  enabled, onStartScrub, onNudgeScrub, onEndScrub, onWake, durationRef,
}: ScrubGestureHandlers): void {
  // Callbacks à jour sans recréer le handler natif.
  const cbRef = useRef({ onStartScrub, onNudgeScrub, onEndScrub, onWake });
  cbRef.current = { onStartScrub, onNudgeScrub, onEndScrub, onWake };
  usePanGesture(enabled);

  const g = useRef({
    active: false,
    engaged: false,
    beganAt: 0,
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

  /** La fin du geste — relâchement, ou silence d'un pan annulé. */
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

  // Coupé (panneau ouvert, démontage) : le geste en cours n'a plus de suite.
  useEffect(() => {
    if (enabled) return undefined;
    const s = g.current;
    if (s.silence) clearTimeout(s.silence);
    if (s.flush) clearTimeout(s.flush);
    Object.assign(s, { active: false, engaged: false, pending: 0, flush: null, silence: null });
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
      Object.assign(s, { active: true, engaged: false, beganAt: Date.now(), lastX: x, pending: 0 });
      armSilence();
      return;
    }
    if (!s.active) return; // pan déjà en cours quand on l'a pris : ignoré
    if (state === "Ended") { finish(); return; }
    armSilence();
    const duration = durationRef.current || 0;
    if (!s.engaged) {
      const dx = Math.abs(x);
      const elapsed = Date.now() - s.beganAt;
      if (!(duration > 0) || dx < ENGAGE_PX || dx < HORIZONTAL_RATIO * Math.abs(y)) return;
      if (elapsed < ENGAGE_DELAY_MS && dx < FLICK_PX) return;
      s.engaged = true;
      s.lastX = x; // le curseur part d'ici : la zone morte ne déplace rien
      cbRef.current.onStartScrub();
      return;
    }
    const step = x - s.lastX;
    s.lastX = x;
    if (step === 0) return;
    s.pending += step * scrubGainFor(Math.abs(velocityX), duration);
    if (!s.flush) s.flush = setTimeout(flushNow, FLUSH_MS);
  });
}
