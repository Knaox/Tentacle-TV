/**
 * Le snapshot catalogique d'un item : ce que la base en sait, et où il est
 * rangé sur le disque.
 *
 * L'orchestration du téléchargement vit dans `snapshot.ts` ; ici, uniquement la
 * table `item_meta` et les chemins sous `meta/<itemId>/`.
 *
 * Portage de la moitié « état » de `apps/desktop/src-tauri/src/downloads/meta.rs`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { mediaFileExists, safeJoin } from "./paths";
import { integer, integerOrNull, text, textOrNull } from "./rows";

/**
 * Version du CONTENU du snapshot.
 *
 * 2 = DTO enrichi (Chapters, Overview, MediaStreams…) et `segments.json` pour
 * « passer l'intro ». Un item sous cette version est re-snapshotté par la
 * réparation au prochain démarrage en ligne.
 */
export const CURRENT_META_VERSION = 2;

export interface MetaSpec {
  itemId: string;
  /** `movie` ou `episode`. */
  kind: string;
  seriesId: string | null;
  seasonId: string | null;
  libraryId: string | null;
  runtimeTicks: number | null;
  title: string | null;
  seriesName: string | null;
  /** Numéro d'épisode — tri du catalogue hors ligne. */
  indexNumber: number | null;
  /** Numéro de saison — regroupement « série · saison ». */
  parentIndexNumber: number | null;
}

/**
 * Écrit ou met à jour la ligne de catalogue.
 *
 * `COALESCE` sur les titres et les numéros : un re-téléchargement qui ne les
 * porte pas ne doit pas effacer ce qu'on savait déjà.
 */
export function upsertItemMeta(db: DatabaseSync, spec: MetaSpec, nowMs: number): void {
  db.prepare(
    `INSERT INTO item_meta (item_id, kind, series_id, season_id, library_id,
                            runtime_ticks, title, series_name,
                            index_number, parent_index_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       kind = excluded.kind,
       series_id = excluded.series_id,
       season_id = excluded.season_id,
       library_id = excluded.library_id,
       runtime_ticks = excluded.runtime_ticks,
       title = COALESCE(excluded.title, item_meta.title),
       series_name = COALESCE(excluded.series_name, item_meta.series_name),
       index_number = COALESCE(excluded.index_number, item_meta.index_number),
       parent_index_number = COALESCE(excluded.parent_index_number, item_meta.parent_index_number),
       updated_at = excluded.updated_at`,
  ).run(
    spec.itemId,
    spec.kind,
    spec.seriesId,
    spec.seasonId,
    spec.libraryId,
    spec.runtimeTicks,
    spec.title,
    spec.seriesName,
    spec.indexNumber,
    spec.parentIndexNumber,
    nowMs,
    nowMs,
  );
}

/** Relit le spec catalogique, posé à la mise en file. */
export function getSpec(db: DatabaseSync, itemId: string): MetaSpec | null {
  const row = db
    .prepare(
      `SELECT item_id, kind, series_id, season_id, library_id, runtime_ticks, title,
              series_name, index_number, parent_index_number
       FROM item_meta WHERE item_id = ?`,
    )
    .get(itemId);
  if (row === undefined) return null;
  return {
    itemId: text(row, "item_id"),
    kind: text(row, "kind"),
    seriesId: textOrNull(row, "series_id"),
    seasonId: textOrNull(row, "season_id"),
    libraryId: textOrNull(row, "library_id"),
    runtimeTicks: integerOrNull(row, "runtime_ticks"),
    title: textOrNull(row, "title"),
    seriesName: textOrNull(row, "series_name"),
    indexNumber: integerOrNull(row, "index_number"),
    parentIndexNumber: integerOrNull(row, "parent_index_number"),
  };
}

/** Enregistre des octets sous la racine, dossiers créés au besoin. */
export function saveBytes(root: string, rel: string, bytes: Uint8Array): boolean {
  try {
    const target = safeJoin(root, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    return true;
  } catch {
    return false;
  }
}

/** Le snapshot est-il déjà là (`item.json`) ? */
export function snapshotExists(root: string, itemId: string): boolean {
  return mediaFileExists(root, `meta/${itemId}/item.json`);
}

/**
 * L'affiche VERTICALE de la série est-elle là ?
 *
 * Elle illustre les groupes « série · saison » du catalogue hors ligne. Les
 * téléchargements antérieurs à son ajout ne l'ont pas — d'où le re-snapshot par
 * la réparation.
 */
export function seriesPrimaryExists(root: string, itemId: string): boolean {
  return mediaFileExists(root, `meta/${itemId}/series-primary.jpg`);
}

/** Version de snapshot enregistrée (0 si jamais posée). */
export function metaVersion(db: DatabaseSync, itemId: string): number {
  const row = db
    .prepare("SELECT COALESCE(meta_version, 0) AS v FROM item_meta WHERE item_id = ?")
    .get(itemId);
  return row === undefined ? 0 : integer(row, "v");
}

/** Marque le snapshot comme fait, avec le résumé de ce qui a réussi. */
export function markSnapshotDone(
  db: DatabaseSync,
  itemId: string,
  imagesState: string,
  nowMs: number,
): void {
  db.prepare(
    "UPDATE item_meta SET images_state = ?, meta_version = ?, updated_at = ? WHERE item_id = ?",
  ).run(imagesState, CURRENT_META_VERSION, nowMs, itemId);
}

/** Pose la bibliothèque de l'item (préférences de pistes hors ligne). */
export function setLibraryId(db: DatabaseSync, itemId: string, libraryId: string): void {
  db.prepare("UPDATE item_meta SET library_id = ? WHERE item_id = ?").run(libraryId, itemId);
}
