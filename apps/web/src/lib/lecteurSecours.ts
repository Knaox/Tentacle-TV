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
 * `annulerBasculeSecours` sert l'outil de debug : retenter mpv sans relancer.
 */

let secours = false;
const abonnes = new Set<() => void>();

function publier(valeur: boolean): void {
  if (secours === valeur) return;
  secours = valeur;
  for (const abonne of abonnes) abonne();
}

/** À brancher sur `onFallbackToWeb` : la session passe au lecteur web. */
export function signalerBasculeSecours(): void {
  publier(true);
}

/** Redonne sa chance au lecteur natif (debug, ou action « réessayer »). */
export function annulerBasculeSecours(): void {
  publier(false);
}

/** Lecture ponctuelle, hors React. */
export function basculeSecoursActive(): boolean {
  return secours;
}

/** La bascule, réactive — pour `Watch` et le bandeau. */
export function useLecteurSecours(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      abonnes.add(onChange);
      return () => abonnes.delete(onChange);
    },
    () => secours,
  );
}
