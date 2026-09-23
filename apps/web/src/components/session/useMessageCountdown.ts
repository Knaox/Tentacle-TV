import { useEffect, useRef, useState } from "react";

/**
 * Le compte à rebours d'un message temporaire, à la seconde.
 *
 * Il se SUSPEND tant qu'on survole le bandeau, qu'on y a mis le focus, ou que
 * la fenêtre est cachée : un message d'administrateur est fait pour être lu,
 * il ne doit pas s'effacer pendant qu'on le lit, ni pendant qu'on est ailleurs.
 *
 * Seules les secondes vivent dans l'état : le bandeau n'est rendu qu'une fois
 * par seconde. La barre qui se vide est une animation CSS, suspendue en même
 * temps (`running`).
 */

const TICK_MS = 250;

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export interface MessageCountdown {
  secondsLeft: number;
  /** Le temps s'écoule (ni survolé, ni caché). */
  running: boolean;
}

export function useMessageCountdown(
  durationMs: number | null,
  held: boolean,
  onDone: () => void,
): MessageCountdown | null {
  const [hidden, setHidden] = useState(pageHidden);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil((durationMs ?? 0) / 1000));
  const remainingRef = useRef(durationMs ?? 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const onVisibility = () => setHidden(pageHidden());
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const running = durationMs !== null && !held && !hidden;

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const base = remainingRef.current;
    const left = () => Math.max(0, base - (Date.now() - startedAt));
    const timer = setInterval(() => {
      const ms = left();
      setSecondsLeft(Math.ceil(ms / 1000));
      if (ms <= 0) {
        clearInterval(timer);
        doneRef.current();
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      // Suspendu : on repartira de ce qui restait, à la milliseconde.
      remainingRef.current = left();
    };
  }, [running]);

  return durationMs === null ? null : { secondsLeft, running };
}
