/**
 * Ce qui doit TENIR la plateforme éveillée, au-delà des transferts en vol
 * (`EngineDeps.onHeld`).
 *
 * `onBusy` ne suit que les transferts qui tournent. Or une file peut n'avoir
 * plus rien en vol et pourtant rien de fini : des titres d'Octave qu'une
 * extension prépare encore (503 + `Retry-After`, `retryAfter.ts`), un film dont
 * le flux a été coupé et qui attend sa relance (`networkRetry.ts`). Le moteur
 * se disait alors « libre » : Android rendait son service de premier plan et la
 * tâche qui garde les minuteurs en marche (`androidKeepAlive.ts`), le bureau
 * quittait sa fin de transferts fenêtre fermée — et la relance programmée ne
 * sonnait jamais. Une playlist gardée hors ligne, application quittée, s'arrêtait
 * aux quelques titres déjà en vol (constat de Damien, 29/10).
 *
 * Trois faits, notifiés à chaque changement de l'un d'eux :
 * - `transferring` : au moins un transfert en vol (la même chose qu'`onBusy`) ;
 * - `awaitingRetry` : au moins une relance programmée (réseau, erreur réparable,
 *   ou serveur qui prépare) ;
 * - `awaitingServer` : parmi elles, au moins une que le SERVEUR a demandée — il
 *   prépare et a dit quand revenir. C'est la seule attente qu'une plateforme
 *   peut tenir longtemps sans regret : une coupure réseau sans fin, elle, ne doit
 *   pas garder un ordinateur éveillé toute la nuit.
 */

import type { DatabaseHandle } from "./adapters";
import { nextRetryDueAt } from "./retry";
import type { TransferEnd } from "./transfer";

export interface HoldState {
  transferring: boolean;
  awaitingRetry: boolean;
  awaitingServer: boolean;
}

export const IDLE_HOLD: HoldState = { transferring: false, awaitingRetry: false, awaitingServer: false };

const same = (a: HoldState, b: HoldState): boolean =>
  a.transferring === b.transferring && a.awaitingRetry === b.awaitingRetry && a.awaitingServer === b.awaitingServer;

export class HoldTracker {
  private state: HoldState = IDLE_HOLD;
  /** Les fichiers dont la DERNIÈRE fin est une attente demandée par le serveur. En mémoire : un redémarrage les redemande. */
  private readonly serverWaits = new Set<number>();

  constructor(
    private readonly db: DatabaseHandle,
    private readonly notify: ((state: HoldState) => void) | undefined,
  ) {}

  /** La fin d'un essai : une attente du serveur se retient, toute autre fin l'oublie. */
  noteEnd(fileId: number, end: TransferEnd): void {
    if (end.kind === "failed" && end.code === "network" && end.retryAfterMs !== undefined) this.serverWaits.add(fileId);
    else this.serverWaits.delete(fileId);
  }

  /** Le fichier repart, est mis en pause ou annulé : ce n'est plus une attente. */
  forget(fileId: number): void {
    this.serverWaits.delete(fileId);
  }

  current(): HoldState {
    return this.state;
  }

  /** Recalcule l'état ; ne notifie qu'à un changement. */
  update(transferring: boolean): void {
    const awaitingRetry = nextRetryDueAt(this.db) !== null;
    // Plus aucune relance programmée : les attentes retenues ne tiennent plus rien (pause système, reprise…).
    if (!awaitingRetry) this.serverWaits.clear();
    const next: HoldState = { transferring, awaitingRetry, awaitingServer: awaitingRetry && this.serverWaits.size > 0 };
    if (same(next, this.state)) return;
    this.state = next;
    this.notify?.(next);
  }
}
