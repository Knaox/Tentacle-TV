/**
 * Opérations transactionnelles sur `files` et `claims` — la déduplication par
 * compteur de références.
 *
 * Un même média demandé par deux comptes = UN fichier (`files`) et un claim par
 * compte. La suppression du DERNIER claim entraîne la suppression physique
 * (fichier et `.part`) ; si plus aucun fichier ne référence l'item, la méta
 * locale part avec lui.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/store.rs`.
 */

import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./db";
import { removeItemMediaDir, removeItemMetaDir, removeMediaFile } from "./paths";
import { bit, integer, integerOrNull, rowId, text, textOrNull, type Row } from "./rows";

/**
 * Une ligne de `files`.
 *
 * Les noms sont ceux que la page attend — c'est le `#[serde(rename_all =
 * "camelCase")]` du Rust. `subtitlesJson` est le seul champ INTERNE : il porte
 * la liste des side-cars à récupérer, et le Rust le marquait
 * `#[serde(skip_serializing)]`. Voir `publicFile`.
 */
export interface FileRow {
  id: number;
  itemId: string;
  mediaSourceId: string;
  variant: string;
  preset: string | null;
  relPath: string;
  expectedSize: number | null;
  bytesDone: number;
  status: string;
  errorCode: string | null;
  audioStreamIndex: number | null;
  burnSubtitleIndex: number | null;
  subtitlesJson: string | null;
}

/** Ce que la page voit d'un fichier : tout, sauf la liste des side-cars. */
export type PublicFile = Omit<FileRow, "subtitlesJson">;

/** Colonnes de `files`, PRÉFIXÉES — les requêtes joignent `claims` et `item_meta`. */
export const FILE_COLS = `files.id, files.item_id, files.media_source_id, files.variant,
   files.preset, files.rel_path, files.expected_size, files.bytes_done, files.status,
   files.error_code, files.audio_stream_index, files.burn_subtitle_index, files.subtitles_json`;

export function mapFileRow(row: Row): FileRow {
  return {
    id: integer(row, "id"),
    itemId: text(row, "item_id"),
    mediaSourceId: text(row, "media_source_id"),
    variant: text(row, "variant"),
    preset: textOrNull(row, "preset"),
    relPath: text(row, "rel_path"),
    expectedSize: integerOrNull(row, "expected_size"),
    bytesDone: integer(row, "bytes_done"),
    status: text(row, "status"),
    errorCode: textOrNull(row, "error_code"),
    audioStreamIndex: integerOrNull(row, "audio_stream_index"),
    burnSubtitleIndex: integerOrNull(row, "burn_subtitle_index"),
    subtitlesJson: textOrNull(row, "subtitles_json"),
  };
}

/** Retire le champ interne avant de traverser l'IPC. */
export function publicFile(file: FileRow): PublicFile {
  const { subtitlesJson: _interne, ...reste } = file;
  return reste;
}

/** Paramètres du mode Allégé et des side-cars, posés à la mise en file. */
export function setLightParams(
  db: DatabaseSync,
  fileId: number,
  audioStreamIndex: number | null,
  burnSubtitleIndex: number | null,
  subtitlesJson: string | null,
): void {
  db.prepare(
    `UPDATE files SET audio_stream_index = ?, burn_subtitle_index = ?, subtitles_json = ?
     WHERE id = ?`,
  ).run(audioStreamIndex, burnSubtitleIndex, subtitlesJson, fileId);
}

/** Identité d'un fichier : item, source, variante, preset. */
export interface FileIdentity {
  itemId: string;
  mediaSourceId: string;
  variant: string;
  preset: string | null;
}

/** Le fichier existe-t-il déjà pour cette identité ? */
export function findFile(
  db: DatabaseSync,
  identity: FileIdentity,
): { id: number; status: string } | null {
  const row = db
    .prepare(
      `SELECT id, status FROM files
       WHERE item_id = ? AND media_source_id = ? AND variant = ?
         AND COALESCE(preset, '') = COALESCE(?, '')`,
    )
    .get(identity.itemId, identity.mediaSourceId, identity.variant, identity.preset);
  return row === undefined ? null : { id: integer(row, "id"), status: text(row, "status") };
}

export interface ClaimSpec extends FileIdentity {
  userId: string;
  relPath: string;
  expectedSize: number | null;
  autoDeleteAfterWatch: boolean;
  nowMs: number;
}

export interface ClaimOutcome {
  fileId: number;
  /** `true` si un transfert a été créé, `false` si on s'est accroché à un existant. */
  created: boolean;
}

/**
 * Attache un claim au fichier correspondant (déduplication), ou crée le
 * fichier en file d'attente. Un fichier `canceled` est RÉACTIVÉ en `queued`.
 */
export function claimOrCreateFile(db: DatabaseSync, spec: ClaimSpec): ClaimOutcome {
  return transaction(db, () => {
    const existing = findFile(db, spec);
    let fileId: number;
    let created: boolean;

    if (existing !== null) {
      if (existing.status === "canceled") {
        db.prepare(
          `UPDATE files SET status = 'queued', bytes_done = 0, error_code = NULL,
                  paused_by_user = 0, updated_at = ? WHERE id = ?`,
        ).run(spec.nowMs, existing.id);
      }
      fileId = existing.id;
      created = false;
    } else {
      const inserted = db
        .prepare(
          `INSERT INTO files (item_id, media_source_id, variant, preset, rel_path,
                              expected_size, bytes_done, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'queued', ?, ?)`,
        )
        .run(
          spec.itemId,
          spec.mediaSourceId,
          spec.variant,
          spec.preset,
          spec.relPath,
          spec.expectedSize,
          spec.nowMs,
          spec.nowMs,
        );
      fileId = rowId(inserted.lastInsertRowid);
      created = true;
    }

    db.prepare(
      `INSERT INTO claims (jellyfin_user_id, file_id, auto_delete_after_watch, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(jellyfin_user_id, file_id) DO NOTHING`,
    ).run(spec.userId, fileId, bit(spec.autoDeleteAfterWatch), spec.nowMs);

    return { fileId, created };
  });
}

export interface DeleteOutcome {
  /** `true` si le fichier physique a été supprimé (dernier claim). */
  fileDeleted: boolean;
  /** `true` si la méta de l'item a aussi été purgée (plus aucun fichier). */
  metaDeleted: boolean;
}

/**
 * Retire le claim d'un utilisateur.
 *
 * Dernier claim → suppression de la ligne `files` EN TRANSACTION, puis
 * suppression physique HORS transaction. L'ordre compte : un échec du système
 * de fichiers n'annule pas l'index, et un orphelin sur le disque sera rattrapé.
 * L'inverse laisserait un index qui promet un fichier disparu.
 */
export function deleteClaim(
  db: DatabaseSync,
  root: string,
  userId: string,
  fileId: number,
): DeleteOutcome {
  const aSupprimer = transaction(db, (): { itemId: string; relPath: string; metaOrphan: boolean } | null => {
    const removed = db
      .prepare("DELETE FROM claims WHERE jellyfin_user_id = ? AND file_id = ?")
      .run(userId, fileId);
    if (removed.changes === 0) return null;

    const remaining = db.prepare("SELECT COUNT(*) AS n FROM claims WHERE file_id = ?").get(fileId);
    if (remaining !== undefined && integer(remaining, "n") > 0) return null;

    const file = db.prepare("SELECT item_id, rel_path FROM files WHERE id = ?").get(fileId);
    if (file === undefined) return null;
    const itemId = text(file, "item_id");
    const relPath = text(file, "rel_path");

    db.prepare("DELETE FROM files WHERE id = ?").run(fileId);
    const siblings = db.prepare("SELECT COUNT(*) AS n FROM files WHERE item_id = ?").get(itemId);
    const metaOrphan = siblings !== undefined && integer(siblings, "n") === 0;
    if (metaOrphan) db.prepare("DELETE FROM item_meta WHERE item_id = ?").run(itemId);

    return { itemId, relPath, metaOrphan };
  });

  if (aSupprimer === null) return { fileDeleted: false, metaDeleted: false };

  removeMediaFile(root, aSupprimer.relPath);
  if (aSupprimer.metaOrphan) {
    removeItemMetaDir(root, aSupprimer.itemId);
    // Plus aucun fichier pour cet item : le dossier média entier part avec lui,
    // side-cars de sous-titres compris — ils restaient sinon orphelins.
    removeItemMediaDir(root, aSupprimer.itemId);
  }
  return { fileDeleted: true, metaDeleted: aSupprimer.metaOrphan };
}

/**
 * Meilleur fichier COMPLET revendiqué par cet utilisateur pour cet item.
 * Original prioritaire sur Allégé — c'est la résolution de source à la lecture.
 */
export function completeFileForItem(
  db: DatabaseSync,
  userId: string,
  itemId: string,
): FileRow | null {
  const row = db
    .prepare(
      `SELECT ${FILE_COLS} FROM files
       JOIN claims ON claims.file_id = files.id
       WHERE claims.jellyfin_user_id = ? AND files.item_id = ?
         AND files.status = 'complete'
       ORDER BY CASE files.variant WHEN 'original' THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get(userId, itemId);
  return row === undefined ? null : mapFileRow(row);
}

/**
 * `mediaSourceId` d'un fichier de cet item, le plus récent. Sert à cibler le
 * manifeste trickplay, dont la clé est le `mediaSourceId` Jellyfin.
 */
export function firstMediaSourceId(db: DatabaseSync, itemId: string): string | null {
  const row = db
    .prepare("SELECT media_source_id FROM files WHERE item_id = ? ORDER BY id DESC LIMIT 1")
    .get(itemId);
  return row === undefined ? null : text(row, "media_source_id");
}

/** Octets occupés sur le disque par TOUS les fichiers, partiels compris. */
export function diskUsage(db: DatabaseSync): number {
  const row = db.prepare("SELECT COALESCE(SUM(bytes_done), 0) AS n FROM files").get();
  return row === undefined ? 0 : integer(row, "n");
}
