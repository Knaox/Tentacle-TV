import { useSyncExternalStore } from "react";

/**
 * La bascule vers le lecteur de secours (web), mémorisée pour la SESSION.
 *
 * Elle vivait dans un `useState` local de `Watch` : chaque navigation vers un
 * autre film remontait la page, oubliait l'échec, et repayait l'init mpv — ou
 * ses huit secondes d'attente — avant de rebasculer. Store module (modèle :
 * `watchTogether/chat/chatUiStore.ts`) : la mémoire survit à la navigation et
 * repart à zéro au relancement de l'application, ce qui redonne sa chance au
 * lecteur natif après une mise à jour ou un correctif.
 *
 * `cancelFallbackSwitch` sert l'outil de debug : retenter mpv sans relancer.
 */

let fallback = false;
const subscribers = new Set<() => void>();

function publish(valeur: boolean): void {
  if (fallback === valeur) return;
  fallback = valeur;
  for (const subscriber of subscribers) subscriber();
}

/** À brancher sur `onFallbackToWeb` : la session passe au lecteur web. */
export function reportFallbackSwitch(): void {
  publish(true);
}

/** Redonne sa chance au lecteur natif (debug, ou action « réessayer »). */
export function cancelFallbackSwitch(): void {
  publish(false);
}

/** Lecture ponctuelle, hors React. */
export function isFallbackActive(): boolean {
  return fallback;
}

/** La bascule, réactive — pour `Watch` et le bandeau. */
export function useFallbackPlayer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => fallback,
  );
}
