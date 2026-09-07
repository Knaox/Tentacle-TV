/**
 * Rapprochement de l'état de visionnage : ce que le serveur sait d'un titre
 * gardé sur l'appareil (vu, position, date) confronté à la progression
 * locale. Dernier écrivain gagne, par date : la ligne locale ne bouge que si
 * `LastPlayedDate` est plus récente que sa propre écriture.
 *
 * Deux règles de plus : « marqué non vu » sur le web annule la date chez
 * Jellyfin — on ne le suit que si rien n'attend en file pour ce titre (sinon
 * c'est notre lecture pas encore poussée qu'on effacerait) ; et une bascule
 * vers « vu » arme l'auto-suppression comme une lecture, l'inverse la lève.
 *
 * Jamais de ligne de file créée ici : ce sont des faits du serveur.
 */

import type { DatabaseHandle } from "./adapters";
import { scheduleOnPlayed } from "./purge";
import { bit, flag, integer, text } from "./rows";

export interface ServerUserData {
  itemId: string;
  played: boolean;
  positionTicks: number;
  /** `LastPlayedDate` en millisecondes ; `null` = jamais vu (ou dé-marqué). */
  lastPlayedAtMs: number | null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/**
 * `GET Items?ids=…&enableUserData=true` (ou une liste nue) → une entrée par
 * item lisible. Ne lève jamais.
 */
export function parseUserDataItems(raw: unknown): ServerUserData[] {
  const wrapper = record(raw);
  const items = Array.isArray(raw) ? raw : wrapper !== null && Array.isArray(wrapper.Items) ? wrapper.Items : [];
  const out: ServerUserData[] = [];
  for (const candidate of items) {
    const item = record(candidate);
    const itemId = item !== null && typeof item.Id === "string" ? item.Id : null;
    if (itemId === null) continue;
    const userData = record(item?.UserData) ?? {};
    const position = userData.PlaybackPositionTicks;
    const positionTicks = typeof position === "number" && Number.isFinite(position) && position > 0 ? Math.floor(position) : 0;
    const parsed = typeof userData.LastPlayedDate === "string" ? Date.parse(userData.LastPlayedDate) : Number.NaN;
    out.push({
      itemId,
      played: userData.Played === true,
      positionTicks,
      lastPlayedAtMs: Number.isFinite(parsed) ? parsed : null,
    });
  }
  return out;
}

/** Les items COMPLETS revendiqués par ce compte — le lot de la lecture groupée. */
export function completeItemIds(db: DatabaseHandle, userId: string): string[] {
  return db
    .prepare(
      `SELECT DISTINCT files.item_id FROM files
       JOIN claims ON claims.file_id = files.id
       WHERE claims.jellyfin_user_id = ? AND files.status = 'complete'
       ORDER BY files.item_id ASC`,
    )
    .all(userId)
    .map((row) => text(row, "item_id"));
}

interface LocalState {
  positionTicks: number;
  played: boolean;
  updatedAt: number;
}

/**
 * Applique l'état serveur quand il est plus récent que le local. Rend les
 * items modifiés. `pendingItemIds` = les titres dont un rapport attend encore
 * d'être poussé : un « dé-marquage » serveur ne les touche pas.
 */
export function applyServerUserData(
  db: DatabaseHandle,
  userId: string,
  entries: readonly ServerUserData[],
  nowMs: number,
  options: { pendingItemIds: ReadonlySet<string> },
): string[] {
  const readLocal = db.prepare(
    "SELECT position_ticks, played, updated_at FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?",
  );
  // Écriture DIRECTE — pas le `MAX(played)` de `setPlaybackState` : ici le serveur fait foi.
  const upsert = db.prepare(
    `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(jellyfin_user_id, item_id) DO UPDATE SET
       position_ticks = excluded.position_ticks,
       played = excluded.played,
       updated_at = excluded.updated_at`,
  );
  const clearDeadline = db.prepare(
    `UPDATE claims SET delete_scheduled_at = NULL
     WHERE jellyfin_user_id = ? AND file_id IN (SELECT id FROM files WHERE item_id = ?)`,
  );

  const changed: string[] = [];
  for (const entry of entries) {
    const row = readLocal.get(userId, entry.itemId);
    const local: LocalState | null = row === undefined
      ? null
      : { positionTicks: integer(row, "position_ticks"), played: flag(row, "played"), updatedAt: integer(row, "updated_at") };

    let next: LocalState | null = null;
    if (entry.lastPlayedAtMs !== null) {
      if (local === null || entry.lastPlayedAtMs > local.updatedAt) {
        next = { positionTicks: entry.played ? 0 : entry.positionTicks, played: entry.played, updatedAt: entry.lastPlayedAtMs };
      }
    } else if (!entry.played && entry.positionTicks === 0 && local !== null && local.played && !options.pendingItemIds.has(entry.itemId)) {
      // « Marquer non vu » sur le web : Jellyfin annule la date.
      next = { positionTicks: 0, played: false, updatedAt: nowMs };
    }
    if (next === null) continue;
    if (local !== null && local.positionTicks === next.positionTicks && local.played === next.played) continue;

    upsert.run(userId, entry.itemId, next.positionTicks, bit(next.played), next.updatedAt);
    const wasPlayed = local?.played ?? false;
    if (!wasPlayed && next.played) scheduleOnPlayed(db, userId, entry.itemId, nowMs);
    else if (wasPlayed && !next.played) clearDeadline.run(userId, entry.itemId);
    changed.push(entry.itemId);
  }
  return changed;
}

/**
 * Élague la file : les rapports synchronisés d'avant `olderThanMs`, et les
 * doublons non synchronisés (seul le plus récent par item compte au drain).
 * Rend le nombre de lignes supprimées.
 */
export function pruneReportQueue(db: DatabaseHandle, userId: string, olderThanMs: number): number {
  const synced = db
    .prepare("DELETE FROM report_queue WHERE jellyfin_user_id = ? AND synced = 1 AND occurred_at_utc < ?")
    .run(userId, olderThanMs);
  const duplicates = db
    .prepare(
      `DELETE FROM report_queue
       WHERE jellyfin_user_id = ? AND synced = 0
         AND id NOT IN (SELECT MAX(id) FROM report_queue WHERE jellyfin_user_id = ? AND synced = 0 GROUP BY item_id)`,
    )
    .run(userId, userId);
  return Number(synced.changes ?? 0) + Number(duplicates.changes ?? 0);
}
