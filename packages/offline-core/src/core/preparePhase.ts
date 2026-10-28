/**
 * La PRÉPARATION d'un titre par le serveur, dite à la page : `files.phase = 'prepare'`.
 *
 * Un titre d'Octave se tire d'une route qui peut d'abord le PRÉPARER — la route
 * `offline` d'une extension (une extraction, `503` + `Retry-After` tant que ce
 * n'est pas prêt), l'Allégé audio du cœur (le transcodage de Jellyfin qui
 * démarre). Pendant ce temps, aucun octet : la page montrait un transfert
 * « commencé » qui ne bougeait pas, puis « gardé » d'un coup (28/10). La phase
 * dit l'attente pour ce qu'elle est.
 *
 * - Posée quand la demande part ; effacée à la première réponse 2xx (le
 *   transfert commence) ; GARDÉE sur un 503 (le serveur prépare, la relance
 *   viendra) ; effacée à toute autre fin.
 * - Un titre de musique seulement (`source_path`) : un film n'en a jamais, et
 *   le mobile (sans musique) n'écrit jamais cette phase. `'finalize'` reste à
 *   lui seul (`engineEnd.ts`).
 */

import type { DatabaseHandle } from "./adapters";
import { getFile, setPhase } from "./queue";
import type { FileRow } from "./store";
import type { TransferEnd } from "./transfer";

export const PREPARE_PHASE = "prepare";

/** Le mot d'un serveur qui prépare encore : la route `offline` des extensions. */
const PREPARING_STATUS = 503;

/** Ce fichier peut-il passer par une préparation du serveur ? */
export function preparedByServer(file: Pick<FileRow, "sourcePath">): boolean {
  return file.sourcePath !== null;
}

/** La demande part : la page dira « Préparation… » jusqu'au premier octet. */
export function enterPrepare(db: DatabaseHandle, file: Pick<FileRow, "id" | "sourcePath" | "phase">, nowMs: number): void {
  if (preparedByServer(file) && file.phase !== PREPARE_PHASE) setPhase(db, file.id, PREPARE_PHASE, nowMs);
}

/** La phase tombe ; `true` si elle était posée (la page doit relire). */
export function leavePrepare(db: DatabaseHandle, fileId: number, nowMs: number): boolean {
  if (getFile(db, fileId)?.phase !== PREPARE_PHASE) return false;
  setPhase(db, fileId, null, nowMs);
  return true;
}

/** Une réponse est arrivée : un 2xx ouvre le transfert. `true` si la page doit relire. */
export function onPrepareResponse(db: DatabaseHandle, fileId: number, status: number, nowMs: number): boolean {
  return status < 400 ? leavePrepare(db, fileId, nowMs) : false;
}

/** La fin d'un essai : la phase reste si le serveur a dit qu'il préparait, et tombe sinon. */
export function settlePrepare(db: DatabaseHandle, fileId: number, end: TransferEnd, lastStatus: number | null, nowMs: number): void {
  const preparing = end.kind === "failed" && end.code === "network" && lastStatus === PREPARING_STATUS;
  if (!preparing) leavePrepare(db, fileId, nowMs);
}
