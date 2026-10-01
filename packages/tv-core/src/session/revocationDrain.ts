import {
  deferRevocation,
  readUnpairJournal,
  settleRevocation,
  type PendingRevocation,
  type SessionStorage,
} from "./unpairJournal";

/**
 * La moitié serveur d'un déjumelage : faire oublier les anciens jetons mis de
 * côté par `beginUnpair`, jusqu'à confirmation.
 *
 * Le serveur expose `POST /api/pair/self/revoke`, authentifié par le jeton à
 * révoquer lui-même : seul celui qui le détient peut le faire oublier, et
 * l'appel est idempotent (une ligne déjà supprimée répond comme une ligne
 * supprimée à l'instant).
 *
 * Le verdict d'une réponse :
 * - 2xx : révoqué ;
 * - 401 / 403 : le jeton n'ouvre plus rien sur ce serveur — révoqué entre-temps
 *   (depuis la liste des appareils, par l'admin) ou signé par un autre secret.
 *   Il n'y a plus rien à faire oublier : soldé ;
 * - 404 / 405 : un serveur d'avant la route. Il ne sait pas révoquer — on
 *   attend qu'il soit mis à jour, sans le marteler ;
 * - réseau coupé, 5xx, 429 : on retente plus tard.
 */

export const REVOCATION_PATH = "/api/pair/self/revoke";

export type RevocationOutcome = "done" | "retry";

/** `null` : aucune réponse (réseau coupé, délai dépassé). */
export function classifyRevocation(status: number | null): RevocationOutcome {
  if (status === null) return "retry";
  if (status >= 200 && status < 300) return "done";
  if (status === 401 || status === 403) return "done";
  return "retry";
}

/** Recul entre deux tentatives : vite d'abord (le serveur revient souvent
 *  aussitôt), puis de plus en plus rarement, une heure au plus. */
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export function revocationRetryDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

/** Envoie une révocation ; rend le statut HTTP, ou `null` sans réponse. */
export type SendRevocation = (revocation: PendingRevocation) => Promise<number | null>;

/**
 * Envoie les révocations dues, une par une, et range chaque verdict dans le
 * marqueur. Chaque écriture relit le marqueur : un déjumelage survenu pendant
 * l'envoi n'est jamais écrasé. Rend le délai avant la prochaine révocation due
 * (`null` : plus rien n'attend).
 */
export async function drainRevocations(
  storage: SessionStorage,
  send: SendRevocation,
  now: () => number,
): Promise<number | null> {
  const due = readUnpairJournal(storage).revocations.filter((r) => r.notBefore <= now());
  for (const revocation of due) {
    let status: number | null;
    try {
      status = await send(revocation);
    } catch {
      status = null;
    }
    if (classifyRevocation(status) === "done") {
      settleRevocation(storage, revocation.token);
    } else {
      deferRevocation(storage, revocation.token, now(), revocationRetryDelay(revocation.attempts));
    }
  }
  return nextRevocationDelay(storage, now());
}

/** Le délai avant la prochaine révocation due, `null` s'il n'y en a plus. */
export function nextRevocationDelay(storage: SessionStorage, at: number): number | null {
  const pending = readUnpairJournal(storage).revocations;
  if (pending.length === 0) return null;
  const soonest = Math.min(...pending.map((r) => r.notBefore));
  return Math.max(0, soonest - at);
}
