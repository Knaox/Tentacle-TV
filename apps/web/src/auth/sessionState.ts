import { useSyncExternalStore } from "react";

/**
 * Drapeau « la session a expiré », en mémoire (il ne doit pas survivre à un
 * rechargement : après une reconnexion réussie, plus rien à signaler).
 *
 * Il ne pilote AUCUNE redirection — c'est le garde de routes d'`App.tsx` qui
 * renvoie vers /login dès que `useUserId()` retombe à null. Ce drapeau ne sert
 * qu'à dire POURQUOI, pour ne pas déposer l'utilisateur sur un écran de
 * connexion sans explication.
 *
 * Miroir web de `apps/mobile/src/auth/sessionState.ts`.
 */

let expired = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((cb) => cb());
}

export function setSessionExpired(value: boolean): void {
  if (expired === value) return;
  expired = value;
  emit();
}

export function isSessionExpired(): boolean {
  return expired;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** `true` tant que l'expiration n'a pas été signalée à l'utilisateur. */
export function useSessionExpired(): boolean {
  return useSyncExternalStore(subscribe, isSessionExpired, () => false);
}
