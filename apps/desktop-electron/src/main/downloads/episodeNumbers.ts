/**
 * Numéros de saison et d'épisode dénormalisés dans `item_meta` (schéma v5).
 *
 * Le catalogue hors ligne regroupe les épisodes par saison et les trie par
 * numéro : relire N `item.json` à chaque rendu serait absurde, ces deux entiers
 * vivent donc en base. Ils sont posés à la mise en file, DTO en main, puis
 * confirmés par le snapshot.
 *
 * Pour les téléchargements ANTÉRIEURS au schéma v5, `backfill` les récupère
 * depuis les `item.json` déjà présents sur le disque — sans réseau, donc
 * opérant même au démarrage cent pour cent hors ligne, contrairement à la
 * réparation.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/episode_numbers.rs`.
 */

import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { asInteger, field, parseJson } from "./json";
import { safeJoin } from "./paths";
import { text } from "./rows";

/** `IndexNumber` et `ParentIndexNumber` d'un DTO Jellyfin brut. */
function lire(itemJson: Uint8Array): { index: number | null; parent: number | null } {
  const dto = parseJson(itemJson);
  return {
    index: asInteger(field(dto, "IndexNumber")),
    parent: asInteger(field(dto, "ParentIndexNumber")),
  };
}

/**
 * Renseigne les numéros depuis un snapshot en mémoire.
 *
 * `false` si le DTO n'en porte pas — un film n'a pas de numéro d'épisode — ou
 * si le JSON est illisible.
 */
export function apply(db: DatabaseSync, itemId: string, itemJson: Uint8Array): boolean {
  const { index, parent } = lire(itemJson);
  if (index === null && parent === null) return false;
  db.prepare(
    `UPDATE item_meta
        SET index_number = COALESCE(?, index_number),
            parent_index_number = COALESCE(?, parent_index_number)
      WHERE item_id = ?`,
  ).run(index, parent, itemId);
  return true;
}

/**
 * Rattrapage hors ligne : les épisodes aux numéros manquants sont complétés
 * depuis leur `item.json` sur le disque. Idempotent — ne cible que les NULL.
 * Retourne le nombre d'items complétés.
 */
export function backfill(db: DatabaseSync, root: string): number {
  const ids = db
    .prepare(
      `SELECT item_id FROM item_meta
        WHERE kind = 'episode' AND (index_number IS NULL OR parent_index_number IS NULL)`,
    )
    .all()
    .map((row) => text(row, "item_id"));

  let remplis = 0;
  for (const itemId of ids) {
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(safeJoin(root, `meta/${itemId}/item.json`));
    } catch {
      continue;
    }
    if (apply(db, itemId, bytes)) remplis += 1;
  }
  return remplis;
}
