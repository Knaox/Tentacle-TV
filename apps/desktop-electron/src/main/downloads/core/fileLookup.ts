/**
 * Retrouver le fichier d'un item : celui qu'on lit, et celui dont on tire le
 * `mediaSourceId`. Deux lectures seules, sorties du magasin — elles servent la
 * lecture et la réparation, pas la tenue des claims.
 */

import type { DatabaseHandle } from "./adapters";
import { text } from "./rows";
import { FILE_COLS, mapFileRow, type FileRow } from "./store";

/**
 * Meilleur fichier COMPLET revendiqué par cet utilisateur pour cet item.
 * Original prioritaire sur Allégé — c'est la résolution de source à la lecture.
 */
export function completeFileForItem(
  db: DatabaseHandle,
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
export function firstMediaSourceId(db: DatabaseHandle, itemId: string): string | null {
  const row = db
    .prepare("SELECT media_source_id FROM files WHERE item_id = ? ORDER BY id DESC LIMIT 1")
    .get(itemId);
  return row === undefined ? null : text(row, "media_source_id");
}
