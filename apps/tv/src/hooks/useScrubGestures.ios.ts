import { useEffect, useRef } from "react";
import type { ScrubGestureHandlers } from "./scrubGestureTypes";

export type { ScrubGestureHandlers, ScrubDir } from "./scrubGestureTypes";

// react-native-tvos expose useTVEventHandler / TVEventControl ; on passe par
// require (comme useTVRemote) pour éviter les frictions de typage du module.
const { useTVEventHandler, TVEventControl } = require("react-native") as {
  useTVEventHandler: (cb: (e: HWEvent) => void) => void;
  TVEventControl: { enableTVPanGesture: () => void; disableTVPanGesture: () => void };
};

interface HWEvent {
  eventType: string;
  body?: { state: "Began" | "Changed" | "Ended"; x: number; y: number; velocityX: number; velocityY: number };
}

/** Déplacement horizontal (points touchpad) avant d'ENTRER en scrub (≠ effleurement). */
const SCRUB_START_PX = 28;
/** Déplacement par PAS de scrub une fois entré (chaque pas = ±10s × palier). */
const SCRUB_STEP_PX = 22;

/**
 * Scrub gestuel — variante **Apple TV (tvOS)**.
 *
 * La Siri Remote n'émet ni `longLeft`/`longRight` ni `rewind`/`fastForward` : sans
 * ça, l'avance/recul rapide était MORTE sur Apple TV. On active le pan gesture
 * (`enableTVPanGesture`) UNIQUEMENT quand on peut scrubber (OSD caché ou scrub en
 * cours) et on traduit le glissement du pouce en pas de scrub — qui déclenchent
 * le MÊME mécanisme partagé que `longLeft`/`longRight` côté Android.
 *
 * Pan actif désactive les swipes directionnels : ce n'est pas gênant ici car on
 * ne l'active que lorsqu'il n'y a pas de boutons à naviguer (OSD caché). Quand
 * l'OSD est visible (boutons), `enabled=false` → navigation focus normale.
 *
 * Note : seuils en points du touchpad — à affiner sur Apple TV réel.
 */
export function useScrubGestures({
  enabled, onStartScrub, onStepScrub, onEndScrub, onWake,
}: ScrubGestureHandlers): void {
  useEffect(() => {
    if (!enabled) return;
    TVEventControl.enableTVPanGesture();
    return () => TVEventControl.disableTVPanGesture();
  }, [enabled]);

  const startXRef = useRef(0);
  const lastStepXRef = useRef(0);
  const scrubbingRef = useRef(false);

  useTVEventHandler((evt: HWEvent) => {
    if (!enabled || evt.eventType !== "pan" || !evt.body) return;
    const { state, x } = evt.body;

    if (state === "Began") {
      startXRef.current = x;
      lastStepXRef.current = x;
      scrubbingRef.current = false;
      return;
    }

    if (state === "Changed") {
      if (!scrubbingRef.current) {
        const totalDx = x - startXRef.current;
        if (Math.abs(totalDx) >= SCRUB_START_PX) {
          scrubbingRef.current = true;
          lastStepXRef.current = x;
          onStartScrub(totalDx > 0 ? "forward" : "backward");
        }
        return;
      }
      const stepDx = x - lastStepXRef.current;
      if (Math.abs(stepDx) >= SCRUB_STEP_PX) {
        lastStepXRef.current = x;
        onStepScrub(stepDx > 0 ? "forward" : "backward");
      }
      return;
    }

    // Ended : glissement franc → garder le scrub ouvert (OK valide / BACK annule) ;
    // simple effleurement → réveiller l'OSD (parité appui ←/→ Android).
    if (scrubbingRef.current) onEndScrub();
    else onWake();
    scrubbingRef.current = false;
  });
}
