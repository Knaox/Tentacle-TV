/**
 * Le compte des coupures réseau d'affilée, par fichier, et l'échéance qui en
 * découle (`networkRetryDelay`). Tenu par le moteur, EN MÉMOIRE seulement : un
 * redémarrage repart de la première marche, ce qui est exactement ce qu'on veut.
 *
 * Une coupure arrivée APRÈS des octets reçus repart elle aussi de la première
 * marche : le serveur répondait, le prochain essai a toutes les chances de
 * passer. Une pause système voulue (Wi-Fi perdu, conditions absentes) ne se
 * relance pas : c'est le retour des conditions qui la relève.
 *
 * Un serveur qui PRÉPARE et dit quand revenir (503 + `Retry-After`,
 * `retryAfter.ts`) n'est pas une coupure : relance à l'heure dite, sans
 * monter d'une marche — la prochaine vraie coupure repart de la première.
 */

import { networkRetryDelay, NETWORK_RETRY_DELAYS_MS } from "./retry";
import type { TransferEnd } from "./transfer";

export class NetworkRetryLadder {
  private readonly attempts = new Map<number, number>();

  constructor(
    private readonly delays: readonly number[] = NETWORK_RETRY_DELAYS_MS,
    /** Combien de tentatives repartent sans délai, MAINTENANT — voir `networkRetryDelay`. */
    private readonly immediate: () => number = () => 0,
  ) {}

  /** L'échéance de la relance d'une fin de transfert, `null` s'il n'y en a pas. */
  dueAt(fileId: number, end: TransferEnd, opts: { moved: boolean; systemSuspended: boolean; nowMs: number }): number | null {
    if (end.kind !== "failed" || end.code !== "network") {
      this.attempts.delete(fileId);
      return null;
    }
    if (opts.systemSuspended) return null;
    if (end.retryAfterMs !== undefined) {
      this.attempts.delete(fileId);
      return opts.nowMs + end.retryAfterMs;
    }
    const attempt = opts.moved ? 0 : (this.attempts.get(fileId) ?? 0);
    this.attempts.set(fileId, attempt + 1);
    const delay = networkRetryDelay(attempt, this.delays, this.immediate());
    return delay === null ? null : opts.nowMs + delay;
  }
}
