import type { JellyfinHealthState } from "@tentacle-tv/shared";

/**
 * L'état de Jellyfin tel que le backend le dit (`server:jellyfin`, canal de
 * session) — le magasin unique des lecteurs, web, bureau, mobile et TV.
 *
 * Ce qu'un lecteur en fait (`outagePlayback`, règle pure) : pendant une panne,
 * un bandeau plutôt qu'une erreur, aucun détecteur de problème ; au retour,
 * le flux se rouvre à la même position avec les mêmes pistes — chaque retour
 * incrémente `recoveries`, la clé que le lecteur surveille.
 *
 * Face à un serveur qui ne connaît pas le message, l'état reste `up` : rien
 * ne change pour le lecteur.
 */

export interface JellyfinHealth {
  state: JellyfinHealthState;
  /** Heure du SERVEUR (ms) où l'état a commencé. */
  since: number;
  /** Heure LOCALE (ms) où ce lecteur a appris la panne en cours ; `null` hors panne. */
  outageSeenAt: number | null;
  /** Nombre de retours (panne → `up`) depuis le lancement. */
  recoveries: number;
  /** Heure locale (ms) du dernier retour ; `null` avant le premier. */
  recoveredAt: number | null;
}

let health: JellyfinHealth = { state: "up", since: 0, outageSeenAt: null, recoveries: 0, recoveredAt: null };
let now: () => number = () => Date.now();
const listeners = new Set<(h: JellyfinHealth) => void>();

/** Le message du backend : l'état et son début. Idempotent sur un état inchangé. */
export function receiveJellyfinHealth(state: JellyfinHealthState, since: number): void {
  if (state === health.state && since === health.since) return;
  const wasDown = health.state !== "up";
  const isDown = state !== "up";
  let { outageSeenAt, recoveries, recoveredAt } = health;
  if (isDown && !wasDown) outageSeenAt = now();
  if (!isDown && wasDown) {
    outageSeenAt = null;
    recoveries += 1;
    recoveredAt = now();
  }
  health = { state, since, outageSeenAt, recoveries, recoveredAt };
  for (const listener of [...listeners]) listener(health);
}

export function getJellyfinHealth(): JellyfinHealth {
  return health;
}

/** Écoute l'état ; rend la fonction de désabonnement. Pas d'appel immédiat. */
export function onJellyfinHealth(listener: (h: JellyfinHealth) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests : horloge et état d'origine. */
export function resetJellyfinHealthForTests(clock?: () => number): void {
  health = { state: "up", since: 0, outageSeenAt: null, recoveries: 0, recoveredAt: null };
  now = clock ?? (() => Date.now());
  listeners.clear();
}
