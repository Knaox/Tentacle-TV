/**
 * Résolution de source à la lecture, et progression locale.
 *
 * `localSource` revérifie le fichier À CHAQUE lecture — existence, et taille
 * exacte pour l'Original. Un fichier supprimé ou tronqué hors de
 * l'application passe en `error` et n'est JAMAIS présenté comme lisible : mieux
 * vaut un téléchargement marqué en défaut qu'un lecteur qui s'ouvre sur du
 * vide.
 *
 * La progression est par utilisateur ; hors ligne, elle alimente aussi la file
 * de resynchronisation vers Jellyfin.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/playback.rs`.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { safeJoin } from "./paths";
import { setStatus } from "./queue";
import { bit, flag, integer, integerOrNull, text, textOrNull } from "./rows";
import { completeFileForItem } from "./store";

export interface LocalSubtitleFile {
  absolutePath: string;
  fileName: string;
}

export interface LocalSource {
  fileId: number;
  variant: string;
  /** Chemin ABSOLU, passé tel quel à mpv (`loadfile`). */
  absolutePath: string;
  subtitleFiles: LocalSubtitleFile[];
  positionTicks: number;
  played: boolean;
  autoDeleteAfterWatch: boolean;
  /** Délai après visionnage (minutes, 0 = immédiat) et échéance posée. */
  autoDeleteDelayMinutes: number;
  deleteScheduledAt: number | null;
  /**
   * Méta dénormalisée : le lecteur reste présentable en démarrage cent pour
   * cent hors ligne, sans aucun DTO serveur.
   */
  title: string | null;
  seriesName: string | null;
  runtimeTicks: number | null;
  indexNumber: number | null;
  parentIndexNumber: number | null;
  /** Bibliothèque de l'item — préférences de pistes hors ligne. */
  libraryId: string | null;
}

/** Side-cars présents sur le disque, triés par nom pour un ordre stable. */
function listSubtitles(root: string, itemId: string): LocalSubtitleFile[] {
  let entries: string[];
  try {
    const dir = safeJoin(root, `media/${itemId}/subs`);
    entries = readdirSync(dir).filter((name) => {
      try {
        return statSync(path.join(dir, name)).isFile();
      } catch {
        return false;
      }
    });
    return entries
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => ({ absolutePath: path.join(dir, fileName), fileName }));
  } catch {
    // Pas de dossier `subs` : c'est le cas courant.
    return [];
  }
}

/**
 * Meilleur fichier local LISIBLE pour cet utilisateur et cet item.
 *
 * `null` — et le fichier marqué en défaut — s'il a disparu ou ne fait plus la
 * taille attendue.
 */
export function localSource(
  db: DatabaseSync,
  root: string,
  userId: string,
  itemId: string,
  nowMs: number,
): LocalSource | null {
  const file = completeFileForItem(db, userId, itemId);
  if (file === null) return null;

  let absolutePath: string;
  let size: number;
  try {
    absolutePath = safeJoin(root, file.relPath);
    size = statSync(absolutePath).size;
  } catch {
    setStatus(db, file.id, "error", "missing", nowMs);
    return null;
  }
  if (file.variant === "original" && file.expectedSize !== null && file.expectedSize > 0) {
    if (size !== file.expectedSize) {
      setStatus(db, file.id, "error", "integrity", nowMs);
      return null;
    }
  }

  const claim = db
    .prepare(
      `SELECT auto_delete_after_watch, auto_delete_delay_minutes, delete_scheduled_at
       FROM claims WHERE jellyfin_user_id = ? AND file_id = ?`,
    )
    .get(userId, file.id);
  const state = db
    .prepare(
      "SELECT position_ticks, played FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?",
    )
    .get(userId, itemId);
  const meta = db
    .prepare(
      `SELECT title, series_name, runtime_ticks, library_id, index_number, parent_index_number
       FROM item_meta WHERE item_id = ?`,
    )
    .get(itemId);

  return {
    fileId: file.id,
    variant: file.variant,
    absolutePath,
    subtitleFiles: listSubtitles(root, itemId),
    positionTicks: state === undefined ? 0 : integer(state, "position_ticks"),
    played: state !== undefined && flag(state, "played"),
    autoDeleteAfterWatch: claim !== undefined && flag(claim, "auto_delete_after_watch"),
    autoDeleteDelayMinutes: claim === undefined ? 0 : integer(claim, "auto_delete_delay_minutes"),
    deleteScheduledAt: claim === undefined ? null : integerOrNull(claim, "delete_scheduled_at"),
    title: meta === undefined ? null : textOrNull(meta, "title"),
    seriesName: meta === undefined ? null : textOrNull(meta, "series_name"),
    runtimeTicks: meta === undefined ? null : integerOrNull(meta, "runtime_ticks"),
    indexNumber: meta === undefined ? null : integerOrNull(meta, "index_number"),
    parentIndexNumber: meta === undefined ? null : integerOrNull(meta, "parent_index_number"),
    libraryId: meta === undefined ? null : textOrNull(meta, "library_id"),
  };
}

/**
 * Progression locale, par utilisateur.
 *
 * `queueForSync` = lecture HORS LIGNE : l'évènement rejoint la file de
 * resynchronisation, dédupliquée au drain.
 *
 * `played` ne redescend JAMAIS par cette voie — le `MAX` est délibéré : une
 * position rejouée depuis le début ne doit pas effacer le fait que l'épisode a
 * été vu.
 */
export function setPlaybackState(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  positionTicks: number,
  played: boolean,
  queueForSync: boolean,
  nowMs: number,
): void {
  db.prepare(
    `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(jellyfin_user_id, item_id) DO UPDATE SET
       position_ticks = excluded.position_ticks,
       played = MAX(playback_state.played, excluded.played),
       updated_at = excluded.updated_at`,
  ).run(userId, itemId, positionTicks, bit(played), nowMs);

  if (queueForSync) {
    db.prepare(
      `INSERT INTO report_queue (jellyfin_user_id, item_id, position_ticks, played, occurred_at_utc)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, itemId, positionTicks, bit(played), nowMs);
  }
}

/**
 * Recommence un item DÉJÀ VU : progression remise à zéro, échéance de
 * suppression annulée.
 *
 * # Pourquoi une commande à part
 *
 * `setPlaybackState` ne fait JAMAIS redescendre `played` — son `MAX` est
 * délibéré, une position rejouée ne doit pas effacer le fait qu'on a vu la fin.
 * Mais la reprise ignore la position d'un item vu (il repart du début, comme
 * chez Jellyfin) : sans une voie explicite pour repartir à neuf, un
 * re-visionnage recommencerait de zéro à CHAQUE ouverture, et les vingt minutes
 * qu'on vient de revoir seraient perdues à chaque fois.
 *
 * L'échéance part avec : elle avait été posée parce que l'item était vu. La
 * laisser ferait disparaître le fichier au beau milieu du re-visionnage.
 *
 * Rien n'est mis en file de resynchronisation : c'est un état LOCAL, qui sert à
 * la reprise. Jellyfin ne dé-marque pas un épisode parce qu'on le relance, et
 * le prochain franchissement du seuil lui enverra `played` de toute façon.
 */
export function restartPlayback(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  nowMs: number,
): void {
  db.prepare(
    `UPDATE playback_state SET position_ticks = 0, played = 0, updated_at = ?
     WHERE jellyfin_user_id = ? AND item_id = ?`,
  ).run(nowMs, userId, itemId);

  db.prepare(
    `UPDATE claims SET delete_scheduled_at = NULL
     WHERE jellyfin_user_id = ?
       AND file_id IN (SELECT id FROM files WHERE item_id = ?)`,
  ).run(userId, itemId);
}

export interface PendingReport {
  id: number;
  itemId: string;
  positionTicks: number;
  played: boolean;
  occurredAtUtc: number;
}

/**
 * Rapports à resynchroniser, DÉDUPLIQUÉS : un seul par item, le plus récent.
 * Les entrées plus anciennes du même item seront marquées en même temps que
 * lui — voir `markItemSynced`.
 */
export function pendingReports(db: DatabaseSync, userId: string): PendingReport[] {
  return db
    .prepare(
      `SELECT id, item_id, position_ticks, played, occurred_at_utc
       FROM report_queue AS rq
       WHERE synced = 0 AND jellyfin_user_id = ?
         AND id = (SELECT MAX(id) FROM report_queue
                   WHERE jellyfin_user_id = rq.jellyfin_user_id
                     AND item_id = rq.item_id AND synced = 0)
       ORDER BY id ASC`,
    )
    .all(userId)
    .map((row) => ({
      id: integer(row, "id"),
      itemId: text(row, "item_id"),
      positionTicks: integer(row, "position_ticks"),
      played: flag(row, "played"),
      occurredAtUtc: integer(row, "occurred_at_utc"),
    }));
}

/** Marque synchronisés TOUS les rapports d'un item jusqu'à `upToId` inclus. */
export function markItemSynced(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  upToId: number,
): void {
  db.prepare(
    `UPDATE report_queue SET synced = 1
     WHERE jellyfin_user_id = ? AND item_id = ? AND id <= ?`,
  ).run(userId, itemId, upToId);
}
