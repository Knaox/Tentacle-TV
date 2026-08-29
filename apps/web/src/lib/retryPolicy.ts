/**
 * Ne jamais retenter une requête que le serveur a REFUSÉE POUR CAUSE DE DÉBIT.
 *
 * Le client retentait tout une fois (`retry: 1`), 429 compris. C'est la pire
 * réponse possible à cette erreur-là : le serveur dit « tu en demandes trop »,
 * et on lui en redemande une de plus — chaque requête refusée en coûtait donc
 * DEUX. Constaté en production : `unread-count` et `notifications/?limit=20`
 * demandés deux fois de suite, 429 les deux fois. Une fois le seuil franchi, on
 * consommait le double, et la minute de disette se prolongeait d'autant.
 *
 * Le reste ne change pas : une panne réseau, un 502 de redémarrage ou un 500
 * gardent leur tentative de rattrapage.
 *
 * Deux formes d'erreur circulent dans l'app, d'où les deux reconnaissances :
 *  - `JellyfinError` (tout ce qui passe par le proxy — catalogue, images,
 *    épisodes : l'écrasante majorité du volume) porte un `status` numérique ;
 *  - les enveloppes de fetch du backend (`useNotifications`, `useTickets`…)
 *    lèvent un `Error` nu dont le message EST le corps de la réponse Fastify,
 *    lequel porte toujours `"statusCode":429`.
 */

/** Corps d'erreur standard de Fastify : `{"statusCode":429,"error":…}`. */
const BODY_429 = /"statusCode"\s*:\s*429\b/;

export function isRateLimitRefusal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { status?: unknown }).status === 429) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && BODY_429.test(message);
}

/** Prédicat `retry` de TanStack Query : une tentative de rattrapage, sauf 429. */
export function retryUnlessRateLimited(failureCount: number, error: unknown): boolean {
  if (isRateLimitRefusal(error)) return false;
  return failureCount < 1;
}
