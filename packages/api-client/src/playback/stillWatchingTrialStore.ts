/**
 * L'essai de « Vous regardez encore ? » (`stillWatchingTrial.ts`, shared) côté
 * React : un singleton de MODULE, comme la session du minuteur
 * (`useStillWatching.ts`) — armé depuis les Réglages, lu par le lecteur à la
 * lecture suivante. Jamais stocké : un redémarrage de l'application l'oublie.
 *
 * Il s'éteint de lui-même au bout de son délai (une minuterie le retire et
 * prévient les Réglages), et il est consommé quand la question est posée.
 */

import {
  armStillWatchingTrial,
  stillWatchingTick,
  stillWatchingTrialLive,
  stillWatchingTrialRemainingMs,
  withStillWatchingTrial,
  type StillWatchingSession,
  type StillWatchingTickInput,
  type StillWatchingTrial,
} from "@tentacle-tv/shared";

let trial: StillWatchingTrial | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setTrial(next: StillWatchingTrial | null): void {
  if (expiry !== null) clearTimeout(expiry);
  expiry = null;
  trial = next;
  const remaining = stillWatchingTrialRemainingMs(next, Date.now());
  if (next !== null && remaining > 0) expiry = setTimeout(() => setTrial(null), remaining);
  listeners.forEach((listener) => listener());
}

/** L'essai en attente de sa lecture, ou null (éteint, consommé, jamais armé). */
export function readStillWatchingTrial(now: number = Date.now()): StillWatchingTrial | null {
  return stillWatchingTrialLive(trial, now) ? trial : null;
}

/** La question vient d'être posée pendant l'essai : il a servi. */
export function consumeStillWatchingTrial(): void {
  if (trial !== null) setTrial(null);
}

/**
 * Un battement du minuteur (`useStillWatching`), l'essai compris : la question
 * avancée tant qu'il vit, puis l'essai consommé au battement qui la POSE. Le
 * reste — décompte, pause à l'expiration, reprise — est le minuteur réel, au
 * réglage du compte.
 */
export function tickWithStillWatchingTrial(session: StillWatchingSession, input: StillWatchingTickInput): StillWatchingSession {
  const live = readStillWatchingTrial(input.now);
  const next = stillWatchingTick(session, { ...input, settings: withStillWatchingTrial(input.settings, live, input.now) });
  if (live !== null && session.phase !== "asking" && next.phase === "asking") consumeStillWatchingTrial();
  return next;
}

/** Pour les bancs et les tests : aucun essai. */
export function resetStillWatchingTrial(): void {
  setTrial(null);
}

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
const readArmed = () => trial !== null;

/** Abonnement et lecture pour `useSyncExternalStore` (`useStillWatchingTrial`). */
export const stillWatchingTrialSource = { subscribe, readArmed };

/** Armer l'essai (un seul : réarmer repart de zéro). */
export function armStillWatchingTrialNow(): void {
  setTrial(armStillWatchingTrial(Date.now()));
}

/** Renoncer à l'essai. */
export function cancelStillWatchingTrial(): void {
  setTrial(null);
}
