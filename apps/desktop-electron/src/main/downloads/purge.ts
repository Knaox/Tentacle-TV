/**
 * Auto-suppression DIFFÉRÉE des téléchargements vus.
 *
 * Deux moments : l'échéance est posée quand l'item passe « vu », et la purge
 * ramasse les échéances passées. La purge tourne au démarrage du moteur —
 * première itération immédiate, donc RATTRAPAGE de ce qui est arrivé à
 * échéance pendant que l'application était fermée —, puis toutes les 60 s, et
 * au démontage du lecteur pour couvrir le délai « immédiatement ».
 *
 * Garde anti-suppression : un claim dont la lecture est active — heartbeat de
 * moins de 60 s — est sauté. Sans elle, un re-visionnage effacerait le film
 * sous les yeux de celui qui le regarde. L'item qui vient de se terminer est
 * explicitement exempté de cette garde : son heartbeat est frais par
 * construction.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/purge.rs`.
 */

import type { DatabaseSync } from "node:sqlite";
import { integer, text } from "./rows";
import { deleteClaim } from "./store";

/** Un heartbeat plus frais que cette fenêtre signale une lecture en cours. */
const ACTIVE_PLAYBACK_MS = 60_000;

/**
 * Pose l'échéance quand l'item passe « vu ». Idempotent : ne touche jamais une
 * échéance déjà posée.
 *
 * Appelée depuis l'enregistrement de progression et non depuis l'interface :
 * elle reste ainsi robuste même si la page meurt avant le démontage du lecteur.
 */
export function scheduleOnPlayed(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  nowMs: number,
): void {
  db.prepare(
    `UPDATE claims SET delete_scheduled_at = ? + auto_delete_delay_minutes * 60
     WHERE jellyfin_user_id = ?
       AND auto_delete_after_watch = 1
       AND delete_scheduled_at IS NULL
       AND file_id IN (SELECT id FROM files WHERE item_id = ?)
       AND EXISTS (SELECT 1 FROM playback_state
                   WHERE jellyfin_user_id = ? AND item_id = ? AND played = 1)`,
  ).run(Math.floor(nowMs / 1000), userId, itemId, userId, itemId);
}

/**
 * Supprime les claims dont l'échéance est passée, TOUS comptes confondus.
 *
 * Le fichier physique ne part qu'au dernier claim — c'est `deleteClaim` qui
 * tient le compteur de références. Retourne le nombre de claims purgés.
 */
export function purgeDueClaims(
  db: DatabaseSync,
  root: string,
  nowMs: number,
  exemptItem: string | null,
): number {
  const dus = db
    .prepare(
      `SELECT c.jellyfin_user_id, c.file_id, f.item_id
       FROM claims c JOIN files f ON f.id = c.file_id
       WHERE c.auto_delete_after_watch = 1
         AND c.delete_scheduled_at IS NOT NULL
         AND c.delete_scheduled_at <= ?`,
    )
    .all(Math.floor(nowMs / 1000))
    .map((row) => ({
      userId: text(row, "jellyfin_user_id"),
      fileId: integer(row, "file_id"),
      itemId: text(row, "item_id"),
    }));

  let purges = 0;
  for (const du of dus) {
    if (du.itemId !== exemptItem && playbackActive(db, du.userId, du.itemId, nowMs)) {
      // Re-visionnage en cours : sauté, retenté au prochain tour.
      continue;
    }
    try {
      deleteClaim(db, root, du.userId, du.fileId);
      // On compte le CLAIM retiré, pas le fichier effacé : avec deux comptes,
      // le premier passage ne touche pas le disque et compte quand même.
      purges += 1;
    } catch {
      // Disque débranché ou droits : le claim sera retenté au tour suivant.
    }
  }
  return purges;
}

function playbackActive(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  nowMs: number,
): boolean {
  const row = db
    .prepare("SELECT updated_at FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?")
    .get(userId, itemId);
  if (row === undefined) return false;
  return nowMs - integer(row, "updated_at") < ACTIVE_PLAYBACK_MS;
}
