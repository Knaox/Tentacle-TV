import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Le compte à rebours d'un message temporaire, à la seconde — la règle du web
 * (`useMessageCountdown`), avec les gestes du mobile.
 *
 * Il se SUSPEND tant que le doigt tient le bandeau, et tant que l'app n'est pas
 * au premier plan : un message d'administrateur est fait pour être lu, il ne
 * doit pas s'effacer pendant qu'on le lit, ni pendant qu'on est ailleurs.
 *
 * Seules les secondes vivent dans l'état : le bandeau n'est rendu qu'une fois
 * par seconde. La barre qui se vide est animée à part, sur le fil UI.
 */

const TICK_MS = 250;

export interface MessageCountdown {
  secondsLeft: number;
  /** Le temps s'écoule (ni tenu, ni en arrière-plan). */
  running: boolean;
  /** Ce qui reste, en ms, relu au moment où on le demande (reprise de la barre). */
  remainingMs: () => number;
}

export function useMessageCountdown(
  durationMs: number | null,
  held: boolean,
  onDone: () => void,
): MessageCountdown | null {
  const [foreground, setForeground] = useState(() => AppState.currentState === "active");
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil((durationMs ?? 0) / 1000));
  const remainingRef = useRef(durationMs ?? 0);
  const startedAtRef = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);

  const running = durationMs !== null && !held && foreground;

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
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
      startedAtRef.current = null;
    };
  }, [running]);

  if (durationMs === null) return null;
  return {
    secondsLeft,
    running,
    remainingMs: () => {
      const startedAt = startedAtRef.current;
      return startedAt === null
        ? remainingRef.current
        : Math.max(0, remainingRef.current - (Date.now() - startedAt));
    },
  };
}
