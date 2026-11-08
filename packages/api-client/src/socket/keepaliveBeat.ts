/**
 * Le BATTEMENT du socket partagé : appelé juste après chaque ping keepalive
 * (toutes les 30 s, `tentacleSocket.ts`), quand le modem du téléphone est déjà
 * réveillé. Ce qui doit partir sur le réseau sans urgence (le rapport d'écoute
 * d'Octave app derrière : `music/player/socketReportPacing.ts`) part avec lui
 * plutôt que de réveiller le modem une fois de plus.
 *
 * Aucun battement sans socket ouvert : un consommateur garde son propre délai
 * de secours.
 */

const listeners = new Set<() => void>();

/** S'abonne au battement ; rend le désabonnement. */
export function onKeepaliveBeat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Un ping keepalive vient de partir. */
export function emitKeepaliveBeat(): void {
  for (const listener of [...listeners]) listener();
}
