import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { BUTTON_SEEK_BASE, buttonSeekRate, buttonSeekTier } from "./scrubAcceleration";

type Ref<T> = MutableRefObject<T>;

interface ButtonSeekArgs {
  durationRef: Ref<number>;
  startScrubbing: (dir?: "forward" | "backward") => void;
  nudgeScrub: (deltaSeconds: number) => void;
  confirmScrub: () => void;
  clearIdleCancel: () => void;
  scrubbingRef: Ref<boolean>;
  scrubViaButtonRef: Ref<boolean>;
  setScrubViaButton: Dispatch<SetStateAction<boolean>>;
  setSpeedLabel: Dispatch<SetStateAction<string | null>>;
}

/**
 * Boutons OSD avance/recul rapide dédiés, modèle MAINTIEN : curseur fantôme qui
 * avance de plus en plus vite tant que le bouton est tenu (rampe), seek + reprise
 * au relâchement. Le focus reste sur le bouton (scrubViaButton → pas de verrou).
 * Extrait VERBATIM de useScrubController (budget 300 lignes).
 */
export function useButtonSeek({
  durationRef, startScrubbing, nudgeScrub, confirmScrub, clearIdleCancel,
  scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel,
}: ButtonSeekArgs) {
  const buttonLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopButtonLoop = useCallback(() => {
    if (buttonLoopRef.current) { clearInterval(buttonLoopRef.current); buttonLoopRef.current = null; }
  }, []);
  useEffect(() => () => stopButtonLoop(), [stopButtonLoop]);

  const startButtonSeek = useCallback((dir: "forward" | "backward") => {
    if (buttonLoopRef.current) return; // déjà en maintien
    const sign = dir === "forward" ? 1 : -1;
    clearIdleCancel();
    scrubViaButtonRef.current = true; setScrubViaButton(true);
    if (!scrubbingRef.current) startScrubbing();   // ghost-scrub (pause), sans dir → pas de moveScrub
    nudgeScrub(sign * BUTTON_SEEK_BASE);           // saut de base immédiat (tap = petit saut)
    setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} 1x`);
    const start = Date.now();
    let last = start;
    buttonLoopRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const held = (now - start) / 1000;
      const rate = buttonSeekRate(held, durationRef.current);
      if (rate > 0) {
        nudgeScrub(sign * rate * dt);
        setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} ${buttonSeekTier(held)}x`);
      }
    }, 33);
  }, [clearIdleCancel, startScrubbing, nudgeScrub]);

  const stopButtonSeek = useCallback(() => {
    if (!buttonLoopRef.current && !scrubViaButtonRef.current) return;
    stopButtonLoop();
    confirmScrub();   // seek vers la position fantôme + reprise (+ reset scrubViaButton)
  }, [stopButtonLoop, confirmScrub]);

  return { startButtonSeek, stopButtonSeek };
}
