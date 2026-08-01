/**
 * Auto-réparation des à-côtés d'un téléchargement.
 *
 * Snapshots, affiches et side-cars manquants pour les fichiers DÉJÀ complets.
 * Lancée en tâche de fond à chaque démarrage du moteur, en ligne. Idempotente —
 * tout ce qui existe est sauté —, best-effort, et c'est elle qui rattrape les
 * téléchargements faits avant un correctif de récupération.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/heal.rs`.
 */

import type { DatabaseSync } from "node:sqlite";
import type { FetchBytes } from "./fetcher";
import { MAX_JSON_BYTES } from "./fetcher";
import { parseJson } from "./json";
import {
  CURRENT_META_VERSION,
  getSpec,
  metaVersion,
  seriesPrimaryExists,
  snapshotExists,
} from "./meta";
import { snapshot } from "./snapshot";
import { firstMediaSourceId } from "./store";
import { fetchAll, parseSpecs } from "./subs";
import { text, textOrNull } from "./rows";
import * as trickplay from "./trickplay";

interface Complet {
  itemId: string;
  mediaSourceId: string;
  subtitlesJson: string | null;
}

function complets(db: DatabaseSync): Complet[] {
  return db
    .prepare(
      `SELECT DISTINCT item_id, media_source_id, subtitles_json
       FROM files WHERE status = 'complete'`,
    )
    .all()
    .map((row) => ({
      itemId: text(row, "item_id"),
      mediaSourceId: text(row, "media_source_id"),
      subtitlesJson: textOrNull(row, "subtitles_json"),
    }));
}

/**
 * Répare ce qui manque. Retourne le nombre d'items touchés.
 *
 * Ne lève jamais : elle tourne en fond, et un item récalcitrant ne doit pas
 * empêcher les suivants d'être réparés.
 */
export async function heal(
  fetchBytes: FetchBytes,
  db: DatabaseSync,
  serverUrl: string,
  root: string,
  nowMs: number,
): Promise<number> {
  let repares = 0;

  for (const item of complets(db)) {
    let touche = false;

    // Snapshot absent, affiche de série manquante, ou snapshot d'une version
    // antérieure (sans segments ni DTO enrichi) : un re-snapshot complet répare
    // tout, et il saute ce qui est déjà en place.
    const spec = getSpec(db, item.itemId);
    if (spec !== null) {
      const afficheSerieManquante =
        spec.seriesId !== null && !seriesPrimaryExists(root, item.itemId);
      const versionDepassee = metaVersion(db, item.itemId) < CURRENT_META_VERSION;
      if (!snapshotExists(root, item.itemId) || afficheSerieManquante || versionDepassee) {
        try {
          await snapshot(fetchBytes, db, serverUrl, root, spec, nowMs);
          touche = true;
        } catch {
          // Item non réparé ce tour-ci ; on continue avec les suivants.
        }
      }
    }

    // Trickplay manquant : récupérer le manifeste puis les planches.
    //
    // Le marqueur `trickplay.none` est ce qui empêche cette requête de
    // repartir à CHAQUE démarrage pour chaque item que le serveur ne sait pas
    // illustrer. Sans lui, un catalogue de cinquante films sans planches
    // faisait cinquante appels au lancement, en série, à chaque fois.
    if (
      !trickplay.exists(root, item.itemId) &&
      !trickplay.noneRecently(root, item.itemId, nowMs)
    ) {
      const itemJson = await fetchBytes(
        `${serverUrl}/api/jellyfin/Items/${item.itemId}?fields=Trickplay`,
        MAX_JSON_BYTES,
      );
      if (itemJson !== null) {
        const msrc = firstMediaSourceId(db, item.itemId) ?? item.itemId;
        const planches = await trickplay.download(
          fetchBytes,
          serverUrl,
          root,
          item.itemId,
          msrc,
          parseJson(itemJson),
          nowMs,
        );
        touche = touche || planches > 0;
      }
    }

    if (item.subtitlesJson !== null) {
      const specs = parseSpecs(item.subtitlesJson);
      if (specs.length > 0) {
        // `fetchAll` saute les fichiers déjà présents : rappeler est gratuit.
        const obtenus = await fetchAll(
          fetchBytes,
          serverUrl,
          root,
          item.itemId,
          item.mediaSourceId,
          specs,
        );
        touche = touche || obtenus > 0;
      }
    }

    if (touche) repares += 1;
  }

  return repares;
}
