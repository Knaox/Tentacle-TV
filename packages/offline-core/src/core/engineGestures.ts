/**
 * Les gestes de l'utilisateur sur un transfert : mettre en pause, reprendre,
 * annuler.
 *
 * Trois fonctions sans état, appelées par l'orchestrateur qui garde pour lui
 * la table des transferts vivants et la relance de la file. Ce qui se décide
 * ici : un transfert en vol reçoit une bascule (il se terminera de lui-même),
 * un transfert encore en file est écrit directement en base.
 */

import type { DatabaseHandle, Volume } from "./adapters";
import { removeMediaFile } from "./paths";
import { getFile, setBytesDone, setPausedByUser, setPhase, setStatus } from "./queue";
import { clearRetry } from "./retry";
import type { TransferFlags } from "./transfer";

/** Pause explicite. Une pause n'est jamais une tentative : le compteur retombe. */
export function pauseFile(
  db: DatabaseHandle,
  fileId: number,
  flags: TransferFlags | undefined,
  nowMs: number,
): void {
  setPausedByUser(db, fileId, true);
  clearRetry(db, fileId);
  if (flags !== undefined) {
    flags.pause = true;
    return;
  }
  // Encore en file : on le sort avant qu'il ne démarre.
  if (getFile(db, fileId)?.status === "queued") setStatus(db, fileId, "paused", null, nowMs);
}

/** Reprise demandée : les tentatives repartent de zéro, l'échéance tombe. */
export function resumeFile(db: DatabaseHandle, fileId: number, nowMs: number): void {
  const file = getFile(db, fileId);
  if (file === null || (file.status !== "paused" && file.status !== "error")) return;
  setPausedByUser(db, fileId, false);
  setStatus(db, fileId, "queued", null, nowMs);
  clearRetry(db, fileId);
}

/**
 * Annulation.
 *
 * Un transfert en vol reçoit la bascule ET l'intention est écrite en base tout
 * de suite. Elle ne l'était pas : la ligne restait `downloading` jusqu'à ce que
 * le transfert veuille bien s'achever, et deux choses en profitaient — une
 * application tuée entre les deux laissait une ligne que
 * `normalizeOnEngineStart` remettait en file, et une exception levée par le
 * pilote coupé net devenait une erreur « imprévue », relancée cinq secondes
 * plus tard. Dans les deux cas, ce qu'on venait d'annuler repartait.
 *
 * Le fichier, lui, n'est retiré que hors vol : le transfert nettoie son `.part`
 * tout seul, et le lui arracher pendant l'écriture ne ferait que des dégâts.
 * `applyEnd` respecte ce statut au lieu de le recouvrir.
 */
export function cancelFile(
  db: DatabaseHandle,
  volume: Volume,
  fileId: number,
  flags: TransferFlags | undefined,
  nowMs: number,
): void {
  const file = getFile(db, fileId);
  if (file === null) return;
  if (flags !== undefined) flags.cancel = true;
  else removeMediaFile(volume, file.relPath);
  setBytesDone(db, fileId, 0, nowMs);
  // Le média part avec l'annulation : plus rien à finaliser.
  setPhase(db, fileId, null, nowMs);
  setStatus(db, fileId, "canceled", null, nowMs);
  clearRetry(db, fileId);
}
