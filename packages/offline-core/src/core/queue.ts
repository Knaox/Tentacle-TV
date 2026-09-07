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

import type { DatabaseHandle } from "./adapters";
import { FILE_COLS, mapFileRow, type FileRow } from "./store";
import { bit, integer } from "./rows";

export function getFile(db: DatabaseHandle, fileId: number): FileRow | null {
  const row = db.prepare(`SELECT ${FILE_COLS} FROM files WHERE files.id = ?`).get(fileId);
  return row === undefined ? null : mapFileRow(row);
}

/** Prochain transfert à lancer. FIFO sur la création. */
export function nextQueued(db: DatabaseHandle): FileRow | null {
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
  db: DatabaseHandle,
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

export function setPausedByUser(db: DatabaseHandle, fileId: number, byUser: boolean): void {
  db.prepare("UPDATE files SET paused_by_user = ? WHERE id = ?").run(bit(byUser), fileId);
}

/** La pause de ce fichier est-elle explicite (l'utilisateur) ? */
export function isPausedByUser(db: DatabaseHandle, fileId: number): boolean {
  const row = db.prepare("SELECT paused_by_user FROM files WHERE id = ?").get(fileId);
  return row !== undefined && integer(row, "paused_by_user") !== 0;
}

/**
 * Étape hors téléchargement du fichier : `null`, ou `'finalize'` quand le média
 * est reçu et n'attend plus que son remux. Écrite AVANT l'appel natif, elle
 * survit à un arrêt de l'application — c'est ce qui évite de retélécharger.
 */
export function setPhase(db: DatabaseHandle, fileId: number, phase: string | null, nowMs: number): void {
  db.prepare("UPDATE files SET phase = ?, updated_at = ? WHERE id = ?").run(phase, nowMs, fileId);
}

/**
 * Taille attendue apprise en cours de route. Ne sert QU'À l'affichage : le
 * contrôle d'intégrité, lui, ne connaît que la taille annoncée par le serveur.
 */
export function setExpectedSize(db: DatabaseHandle, fileId: number, bytes: number, nowMs: number): void {
  db.prepare("UPDATE files SET expected_size = ?, updated_at = ? WHERE id = ?").run(bytes, nowMs, fileId);
}

export function setBytesDone(
  db: DatabaseHandle,
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
export function normalizeOnEngineStart(db: DatabaseHandle, nowMs: number): void {
  db.prepare(
    `UPDATE files SET status = 'queued', updated_at = ?
     WHERE status = 'downloading'
        OR (status = 'paused' AND paused_by_user = 0)`,
  ).run(nowMs);
}

/**
 * Remet en file les seules pauses SYSTÈME. Renvoie le nombre de reprises.
 *
 * C'est `normalizeOnEngineStart` MOINS le rattrapage des `downloading`, et
 * cette soustraction est tout l'intérêt : appelée au réveil de veille, moteur
 * vivant, elle ne doit surtout pas remettre en file un transfert qui est en
 * train d'écrire. Il se retrouverait lancé deux fois sur le même `.part`.
 */
export function requeueSystemPauses(db: DatabaseHandle, nowMs: number): number {
  const done = db
    .prepare(
      `UPDATE files SET status = 'queued', updated_at = ?
       WHERE status = 'paused' AND paused_by_user = 0`,
    )
    .run(nowMs);
  return Number(done.changes);
}

/**
 * Pause SYSTÈME de tout ce qui attend une place. Renvoie le nombre de
 * transferts mis de côté ; `resumeSystemPauses` les remettra en file.
 */
export function suspendQueued(db: DatabaseHandle, nowMs: number): number {
  const done = db
    .prepare(
      `UPDATE files SET status = 'paused', paused_by_user = 0, updated_at = ?
       WHERE status = 'queued'`,
    )
    .run(nowMs);
  return Number(done.changes);
}

/**
 * Les transferts que « tout mettre en pause » vise : ce qui tourne et ce qui
 * attend. Les pauses en cours n'y sont pas — les reprendre serait l'inverse.
 */
export function runningFileIds(db: DatabaseHandle): number[] {
  return db
    .prepare("SELECT id FROM files WHERE status IN ('queued', 'downloading') ORDER BY id")
    .all()
    .map((row) => integer(row, "id"));
}

/** Les transferts mis en pause PAR L'UTILISATEUR — ceux qu'une reprise globale relance. */
export function userPausedFileIds(db: DatabaseHandle): number[] {
  return db
    .prepare("SELECT id FROM files WHERE status = 'paused' AND paused_by_user = 1 ORDER BY id")
    .all()
    .map((row) => integer(row, "id"));
}

/** Transferts en attente d'une place. */
export function countQueued(db: DatabaseHandle): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM files WHERE status = 'queued'").get();
  return row === undefined ? 0 : integer(row, "n");
}

/**
 * Octets restants estimés des transferts actifs ou en attente — ils entrent
 * dans le contrôle d'espace disque d'une nouvelle mise en file, sans quoi on
 * promettrait deux fois la même place.
 */
export function pendingBytes(db: DatabaseHandle): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(MAX(COALESCE(expected_size, 0) - bytes_done, 0)), 0) AS n
       FROM files WHERE status IN ('queued', 'downloading', 'paused')`,
    )
    .get();
  return row === undefined ? 0 : integer(row, "n");
}
