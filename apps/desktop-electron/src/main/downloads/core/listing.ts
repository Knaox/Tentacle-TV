/**
 * Lectures composées pour l'interface : la liste des téléchargements d'un
 * utilisateur (titres dénormalisés compris), l'état par item pour les badges de
 * fiche, et la bascule « supprimer après visionnage » — portée par le CLAIM,
 * donc par utilisateur.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/listing.rs`.
 */

import type { DatabaseHandle } from "./adapters";
import { FILE_COLS, mapFileRow, publicFile, type PublicFile } from "./store";
import { flag, integer, integerOrNull, text, textOrNull, type Row } from "./rows";

/** Une entrée telle que la page la consomme (`DownloadEntry`, `api.ts`). */
export type DownloadKind = "movie" | "episode";

function kindOf(row: Row): DownloadKind | null {
  const value = textOrNull(row, "kind");
  if (value === null) return null;
  if (value !== "movie" && value !== "episode") throw new Error(`colonne kind : valeur inattendue ${value}`);
  return value;
}

export interface DownloadListEntry extends PublicFile {
  title: string | null;
  seriesName: string | null;
  kind: DownloadKind | null;
  seriesId: string | null;
  seasonId: string | null;
  /** La bibliothèque Jellyfin d'origine (Films, Séries, Animés…) : le filtre du catalogue local. */
  libraryId: string | null;
  /** Numéros d'épisode et de saison : regroupement et tri du catalogue local. */
  indexNumber: number | null;
  parentIndexNumber: number | null;
  /** Durée, affichée sur les vignettes d'épisode. */
  runtimeTicks: number | null;
  autoDeleteAfterWatch: boolean;
  /** Délai après visionnage avant suppression (minutes, 0 = immédiat). */
  autoDeleteDelayMinutes: number;
  /** Échéance de suppression (epoch SECONDES), posée quand l'item est vu. */
  deleteScheduledAt: number | null;
  /**
   * Progression locale de CE compte, pour la coche « vu » et la barre des
   * vignettes du catalogue hors ligne.
   *
   * Elle ne venait de nulle part : hors ligne, il n'y a aucun DTO serveur à
   * interroger, et cette liste était la seule voie. Un film regardé restait donc
   * affiché comme neuf alors que la base disait le contraire.
   */
  played: boolean;
  positionTicks: number;
  /** Date d'ajout du fichier (epoch MILLISECONDES) — les « derniers ajoutés » du catalogue local. */
  createdAt: number;
  /**
   * Dernière écriture de la progression de CE compte (epoch MILLISECONDES), `null`
   * sans lecture — l'ordre de « Reprendre ». ⚠️ `deleteScheduledAt` est en SECONDES.
   */
  lastPlayedAt: number | null;
  /**
   * Pause EXPLICITE (l'utilisateur a appuyé sur pause, jamais relevée toute
   * seule) ou pause SYSTÈME (réseau, Wi-Fi seulement — relevée dès que les
   * conditions reviennent). L'écran de gestion ne les libelle pas pareil.
   */
  pausedByUser: boolean;
}

const EXTRA_COLS = `item_meta.title, item_meta.series_name, item_meta.kind, item_meta.series_id,
   item_meta.season_id, item_meta.library_id, item_meta.index_number, item_meta.parent_index_number,
   item_meta.runtime_ticks, claims.auto_delete_after_watch,
   claims.auto_delete_delay_minutes, claims.delete_scheduled_at,
   playback_state.played, playback_state.position_ticks,
   files.created_at, playback_state.updated_at AS last_played_at, files.paused_by_user`;

/**
 * Progression du PROPRIÉTAIRE DU CLAIM, jamais d'un autre compte : deux
 * personnes partagent le même fichier et n'en sont pas au même endroit.
 */
const PLAYBACK_JOIN = `LEFT JOIN playback_state
     ON playback_state.item_id = files.item_id
    AND playback_state.jellyfin_user_id = claims.jellyfin_user_id`;

function mapEntry(row: Row): DownloadListEntry {
  return {
    ...publicFile(mapFileRow(row)),
    title: textOrNull(row, "title"),
    seriesName: textOrNull(row, "series_name"),
    kind: kindOf(row),
    seriesId: textOrNull(row, "series_id"),
    seasonId: textOrNull(row, "season_id"),
    libraryId: textOrNull(row, "library_id"),
    indexNumber: integerOrNull(row, "index_number"),
    parentIndexNumber: integerOrNull(row, "parent_index_number"),
    runtimeTicks: integerOrNull(row, "runtime_ticks"),
    autoDeleteAfterWatch: flag(row, "auto_delete_after_watch"),
    autoDeleteDelayMinutes: integer(row, "auto_delete_delay_minutes"),
    deleteScheduledAt: integerOrNull(row, "delete_scheduled_at"),
    // Jointure EXTERNE : un item jamais ouvert n'a pas de ligne de progression,
    // et `flag` lèverait sur le NULL que rend alors SQLite.
    played: (integerOrNull(row, "played") ?? 0) !== 0,
    positionTicks: integerOrNull(row, "position_ticks") ?? 0,
    createdAt: integer(row, "created_at"),
    lastPlayedAt: integerOrNull(row, "last_played_at"),
    pausedByUser: flag(row, "paused_by_user"),
  };
}

export function listForUser(db: DatabaseHandle, userId: string): DownloadListEntry[] {
  return db
    .prepare(
      `SELECT ${FILE_COLS}, ${EXTRA_COLS} FROM files
       JOIN claims ON claims.file_id = files.id
       LEFT JOIN item_meta ON item_meta.item_id = files.item_id
       ${PLAYBACK_JOIN}
       WHERE claims.jellyfin_user_id = ?
       ORDER BY files.created_at DESC, files.id DESC`,
    )
    .all(userId)
    .map(mapEntry);
}

/**
 * État de téléchargement d'un item pour CE compte, pour le badge de fiche : le
 * fichier complet en priorité, sinon le transfert le plus récent.
 */
export function stateForItem(
  db: DatabaseHandle,
  userId: string,
  itemId: string,
): DownloadListEntry | null {
  const row = db
    .prepare(
      `SELECT ${FILE_COLS}, ${EXTRA_COLS} FROM files
       JOIN claims ON claims.file_id = files.id
       LEFT JOIN item_meta ON item_meta.item_id = files.item_id
       ${PLAYBACK_JOIN}
       WHERE claims.jellyfin_user_id = ? AND files.item_id = ?
       ORDER BY CASE files.status WHEN 'complete' THEN 0 ELSE 1 END,
                CASE files.variant WHEN 'original' THEN 0 ELSE 1 END,
                files.created_at DESC
       LIMIT 1`,
    )
    .get(userId, itemId);
  return row === undefined ? null : mapEntry(row);
}

/**
 * Bascule et délai d'auto-suppression d'un claim.
 *
 * Trois comportements, et chacun évite une surprise :
 *  - OFF remet TOUT à zéro, échéance comprise ;
 *  - ON avec une échéance déjà posée et un délai changé REBASE : l'échéance
 *    reste ancrée au moment du visionnage d'origine, pas à maintenant ;
 *  - ON sur un item DÉJÀ vu et sans échéance planifie depuis maintenant —
 *    jamais de suppression immédiate pour avoir coché une case a posteriori.
 */
export function setAutoDelete(
  db: DatabaseHandle,
  userId: string,
  fileId: number,
  enabled: boolean,
  delayMinutes: number,
  nowMs: number,
): void {
  if (!enabled) {
    db.prepare(
      `UPDATE claims SET auto_delete_after_watch = 0, auto_delete_delay_minutes = 0,
              delete_scheduled_at = NULL
       WHERE jellyfin_user_id = ? AND file_id = ?`,
    ).run(userId, fileId);
    return;
  }

  const delay = Math.max(0, delayMinutes);
  const current = db
    .prepare(
      `SELECT c.delete_scheduled_at, c.auto_delete_delay_minutes, f.item_id
       FROM claims c JOIN files f ON f.id = c.file_id
       WHERE c.jellyfin_user_id = ? AND c.file_id = ?`,
    )
    .get(userId, fileId);
  if (current === undefined) return;

  const scheduled = integerOrNull(current, "delete_scheduled_at");
  const oldDelay = integer(current, "auto_delete_delay_minutes");
  const itemId = text(current, "item_id");

  let newScheduled: number | null;
  if (scheduled !== null) {
    newScheduled = scheduled - oldDelay * 60 + delay * 60;
  } else {
    const state = db
      .prepare("SELECT played FROM playback_state WHERE jellyfin_user_id = ? AND item_id = ?")
      .get(userId, itemId);
    const played = state !== undefined && flag(state, "played");
    newScheduled = played ? Math.floor(nowMs / 1000) + delay * 60 : null;
  }

  db.prepare(
    `UPDATE claims SET auto_delete_after_watch = 1, auto_delete_delay_minutes = ?,
            delete_scheduled_at = ?
     WHERE jellyfin_user_id = ? AND file_id = ?`,
  ).run(delay, newScheduled, userId, fileId);
}
