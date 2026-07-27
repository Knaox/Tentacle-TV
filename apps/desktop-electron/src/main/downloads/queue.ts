/**
 * État de la file de téléchargement (table `files`).
 *
 * Statuts : `queued` → `downloading` → `complete` | `paused` | `error` |
 * `canceled`.
 *
 * `paused_by_user` distingue une pause EXPLICITE — jamais reprise toute seule —
 * d'une pause SYSTÈME (coupure réseau, redémarrage), qui repart d'elle-même au
 * retour en ligne. Sans cette distinction, une pause volontaire serait défaite
 * au prochain démarrage.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/queue.rs`.
 */

import type { DatabaseSync } from "node:sqlite";
import { FILE_COLS, mapFileRow, type FileRow } from "./store";
import { bit, integer } from "./rows";

export function getFile(db: DatabaseSync, fileId: number): FileRow | null {
  const row = db.prepare(`SELECT ${FILE_COLS} FROM files WHERE files.id = ?`).get(fileId);
  return row === undefined ? null : mapFileRow(row);
}

/** Prochain transfert à lancer. FIFO sur la création. */
export function nextQueued(db: DatabaseSync): FileRow | null {
  const row = db
    .prepare(
      `SELECT ${FILE_COLS} FROM files
       WHERE files.status = 'queued'
       ORDER BY files.created_at ASC, files.id ASC LIMIT 1`,
    )
    .get();
  return row === undefined ? null : mapFileRow(row);
}

export function setStatus(
  db: DatabaseSync,
  fileId: number,
  status: string,
  errorCode: string | null,
  nowMs: number,
): void {
  db.prepare("UPDATE files SET status = ?, error_code = ?, updated_at = ? WHERE id = ?").run(
    status,
    errorCode,
    nowMs,
    fileId,
  );
}

export function setPausedByUser(db: DatabaseSync, fileId: number, byUser: boolean): void {
  db.prepare("UPDATE files SET paused_by_user = ? WHERE id = ?").run(bit(byUser), fileId);
}

export function setBytesDone(
  db: DatabaseSync,
  fileId: number,
  bytes: number,
  nowMs: number,
): void {
  db.prepare("UPDATE files SET bytes_done = ?, updated_at = ? WHERE id = ?").run(
    bytes,
    nowMs,
    fileId,
  );
}

/**
 * Au démarrage du moteur : les transferts interrompus (`downloading` — le
 * processus a été tué en cours de route) et les pauses SYSTÈME redeviennent
 * `queued`. Les pauses UTILISATEUR restent.
 */
export function normalizeOnEngineStart(db: DatabaseSync, nowMs: number): void {
  db.prepare(
    `UPDATE files SET status = 'queued', updated_at = ?
     WHERE status = 'downloading'
        OR (status = 'paused' AND paused_by_user = 0)`,
  ).run(nowMs);
}

/**
 * Octets restants estimés des transferts actifs ou en attente — ils entrent
 * dans le contrôle d'espace disque d'une nouvelle mise en file, sans quoi on
 * promettrait deux fois la même place.
 */
export function pendingBytes(db: DatabaseSync): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(MAX(COALESCE(expected_size, 0) - bytes_done, 0)), 0) AS n
       FROM files WHERE status IN ('queued', 'downloading', 'paused')`,
    )
    .get();
  return row === undefined ? 0 : integer(row, "n");
}
