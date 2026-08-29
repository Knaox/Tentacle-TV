import { useSyncExternalStore } from "react";

/**
 * Quatre clics sur le logo ouvrent le classement de visionnage.
 *
 * L'état vit au NIVEAU MODULE, pas dans React, et ce n'est pas un raccourci :
 * le logo est un lien vers l'accueil, donc le premier clic NAVIGUE pour de bon.
 * Un état porté par un composant serait balayé par ce changement de route et le
 * compte repartirait de zéro à chaque fois. Même raisonnement que
 * `detailTransition.ts`, qui est un module et non un contexte pour survivre au
 * démontage de la route de départ.
 *
 * On laisse d'ailleurs la navigation se faire : intercepter le clic du logo
 * casserait son comportement normal pour tout le monde, au bénéfice d'une
 * surprise. Les trois clics suivants tombent sur l'accueil, où re-naviguer vers
 * l'accueil n'est rien.
 */

const REQUIRED_CLICKS = 4;

/** Assez large pour un quadruple clic tranquille, trop court pour se déclencher par hasard. */
const WINDOW_MS = 900;

let count = 0;
let lastClick = 0;
let open = false;

const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  for (const a of subscribers) a();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/** À poser sur le logo. Ne bloque jamais la navigation. */
export function countLogoClick(): void {
  const now = Date.now();
  count = now - lastClick > WINDOW_MS ? 1 : count + 1;
  lastClick = now;
  if (count < REQUIRED_CLICKS) return;
  count = 0;
  open = true;
  notifySubscribers();
}

export function closeLeaderboard(): void {
  // Le compteur repart de zéro à la fermeture : sans cela, des clics laissés en
  // route se cumuleraient avec ceux de la prochaine fois et le panneau se
  // rouvrirait au bout de deux clics, sans qu'on comprenne pourquoi.
  count = 0;
  if (!open) return;
  open = false;
  notifySubscribers();
}

/** Lecture directe de l'état — sert de `getSnapshot` au hook, et aux tests. */
export function isLeaderboardOpen(): boolean {
  return open;
}

export function useLeaderboardOpen(): boolean {
  return useSyncExternalStore(subscribe, isLeaderboardOpen, () => false);
}
