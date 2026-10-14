/* ------------------------------------------------------------------ */
/*  Ménager Dailymotion : cadence de l'API, des flux, et disjoncteur    */
/*                                                                     */
/*  L'API publique répond sans clé et ne documente aucun quota de      */
/*  lecture : on s'impose le nôtre (`sourceGuard.ts`).                 */
/*  - l'API (recherche sur la chaîne d'AlloCiné) : 5 requêtes d'avance,*/
/*    puis une toutes les 2 s, et 300 par heure pour tout le serveur — */
/*    une recherche sert toutes les saisons d'une série, une semaine ; */
/*  - les FLUX (métadonnées d'une vidéo, `dailymotionSource.ts`) : deux*/
/*    résolutions par seconde au plus ;                                */
/*  - le DISJONCTEUR : un 429, un 403 de l'API ou trois erreurs 5xx    */
/*    d'affilée → 30 min de pause, doublées jusqu'à 4 h, remises à zéro */
/*    au premier succès ;                                              */
/*  - le FOND cède la place : rien en arrière-plan dans les 30 s qui   */
/*    suivent un appel attendu par quelqu'un.                          */
/* ------------------------------------------------------------------ */

import { SlidingBudget, SourceBreaker, TokenBuckets, type GuardStatus } from "./sourceGuard";

export type DailymotionCall = "api" | "stream";
export type DailymotionPriority = "interactive" | "background";

export const DAILYMOTION_API_PER_HOUR = 300;
const HOUR_MS = 60 * 60_000;
const SERVER_ERRORS_TO_TRIP = 3;
const BACKGROUND_PAUSE_MS = 30_000;

export const dailymotionBreaker = new SourceBreaker({
  tripLine: (reason, min) =>
    `[trailers] Dailymotion ${reason === "errors" ? "répond en erreur" : "limite les demandes de ce serveur"} — appels suspendus ${min} min`,
  recoveredLine: "[trailers] Dailymotion répond de nouveau",
});
export const dailymotionApiBudget = new SlidingBudget(DAILYMOTION_API_PER_HOUR, HOUR_MS);
const apiPace = new TokenBuckets(5, 2_000);
const streamPace = new TokenBuckets(2, 500);
let serverErrors = 0;
let lastInteractiveAt = -Infinity;

/**
 * Un appel à Dailymotion peut-il partir ? 0 : oui (il est compté) ; sinon
 * dans combien de ms redemander — `Infinity` quand le disjoncteur est ouvert
 * ou le budget de l'heure épuisé au-delà de ce qu'une attente justifie.
 */
export function takeDailymotionSlot(call: DailymotionCall, priority: DailymotionPriority = "interactive", now = Date.now()): number {
  const paused = dailymotionBreaker.remainingMs(now);
  if (paused > 0) return paused;
  if (priority === "background" && now - lastInteractiveAt < BACKGROUND_PAUSE_MS) return lastInteractiveAt + BACKGROUND_PAUSE_MS - now;
  if (call === "stream") {
    const wait = streamPace.take("*", now);
    if (wait === 0 && priority === "interactive") lastInteractiveAt = now;
    return wait;
  }
  const budgetWait = dailymotionApiBudget.refusal(now);
  if (budgetWait !== null) return budgetWait;
  const wait = apiPace.take("*", now);
  if (wait > 0) return wait;
  dailymotionApiBudget.count(now);
  if (priority === "interactive") lastInteractiveAt = now;
  return 0;
}

/** La réponse d'un appel : un succès referme le disjoncteur ; un 429, un 403 ou trois 5xx d'affilée l'ouvrent. */
export function recordDailymotionResponse(status: number, now = Date.now()): void {
  if (status >= 200 && status < 400) {
    serverErrors = 0;
    dailymotionBreaker.recordSuccess(now);
    return;
  }
  if (status === 429 || status === 403) {
    serverErrors = 0;
    dailymotionBreaker.trip("limit", now);
    return;
  }
  if (status >= 500) {
    serverErrors += 1;
    if (serverErrors >= SERVER_ERRORS_TO_TRIP) {
      serverErrors = 0;
      dailymotionBreaker.trip("errors", now);
    }
  }
}

/** L'état de Dailymotion pour l'administration. */
export function dailymotionGuardStatus(now = Date.now()): GuardStatus {
  return dailymotionBreaker.status(now);
}

/** Pour les tests : tout repart de zéro. */
export function resetDailymotionGuard(): void {
  dailymotionBreaker.reset();
  dailymotionApiBudget.reset();
  apiPace.reset();
  streamPace.reset();
  serverErrors = 0;
  lastInteractiveAt = -Infinity;
}
