/**
 * Ce que les titres gardés occupent sur l'appareil.
 *
 * La somme se lit en base plutôt que sur le disque : un parcours de dossiers à
 * chaque affichage coûterait cher pour une valeur qui ne bouge qu'aux
 * transferts. Le prix de ce choix, c'est qu'une ligne qui ment fait mentir
 * l'écran — d'où la réparation qui recale la base sur le disque.
 */

import type { DatabaseHandle, Volume } from "./adapters";
import { safeJoin } from "./paths";
import { setBytesDone, setStatus } from "./queue";
import { integer, text } from "./rows";

/** Octets occupés sur le disque par TOUS les fichiers, partiels compris. */
export function diskUsage(db: DatabaseHandle): number {
  const row = db.prepare("SELECT COALESCE(SUM(bytes_done), 0) AS n FROM files").get();
  return row === undefined ? 0 : integer(row, "n");
}

/** Ce que la réparation a trouvé — de quoi décider s'il faut notifier l'écran. */
export interface UsageRepair {
  /** Lignes dont la taille en base ne correspondait pas au disque. */
  rebased: number;
  /** Fichiers `complete` dont le média a disparu, passés en défaut. */
  missing: number;
  /** Restes d'une finalisation interrompue, `.part` abandonnés, orphelins. */
  removed: number;
}

/** Statuts qu'on peut mesurer sans risque : plus rien n'écrit dans le fichier. */
const SETTLED: ReadonlySet<string> = new Set(["complete", "error", "paused", "canceled"]);

/** Statuts dont le `.part` sert encore : le jeter détruirait la reprise. */
const KEEPS_PART: ReadonlySet<string> = new Set(["queued", "downloading", "paused", "error"]);

/**
 * Recale la base sur le disque et balaie ce qui n'a plus de propriétaire.
 *
 * Trois écarts se creusent avec le temps : une taille périmée (un remux
 * interrompu laissait un fichier complet compté pour un dixième de sa taille),
 * le temporaire d'une finalisation tuée en plein export, et un média sans
 * ligne — la suppression efface la ligne d'abord, et un arrêt entre les deux
 * laisse le fichier orphelin.
 *
 * `skipFileIds` : les transferts vivants, dont le fichier grossit pendant
 * qu'on regarde. `removeOrphans` : effacer ce qui n'a plus de propriétaire —
 * un effacement automatique se mérite, la plateforme le demande explicitement.
 */
export function repairUsage(
  db: DatabaseHandle,
  volume: Volume,
  nowMs: number,
  options: { skipFileIds: ReadonlySet<number>; removeOrphans: boolean },
): UsageRepair {
  const report: UsageRepair = { rebased: 0, missing: 0, removed: 0 };
  const known = new Map<string, string>();
  // Un remux en cours écrit son temporaire dans le dossier de l'item : on ne
  // balaie pas un dossier dont un transfert est vivant.
  const busyItems = new Set<string>();

  for (const row of db.prepare("SELECT id, item_id, rel_path, bytes_done, status FROM files").all()) {
    const fileId = integer(row, "id");
    const relPath = text(row, "rel_path");
    const status = text(row, "status");
    known.set(relPath, status);
    if (options.skipFileIds.has(fileId)) {
      busyItems.add(text(row, "item_id"));
      continue;
    }
    if (!SETTLED.has(status)) continue;

    const size = volume.files.size(safeJoin(volume, relPath));
    if (size === null) {
      // Même verdict que la lecture locale, qui bute déjà sur ce cas.
      if (status !== "complete") continue;
      setStatus(db, fileId, "error", "missing", nowMs);
      setBytesDone(db, fileId, 0, nowMs);
      report.missing += 1;
    } else if (size !== integer(row, "bytes_done")) {
      setBytesDone(db, fileId, size, nowMs);
      report.rebased += 1;
    }
  }

  report.removed = sweepMediaDirs(db, volume, known, busyItems, options.removeOrphans);
  return report;
}

/** Un fichier trouvé sur le disque doit-il partir ? */
function isStale(name: string, rel: string, known: ReadonlyMap<string, string>, removeOrphans: boolean): boolean {
  // Le temporaire d'un remux : les deux plateformes écrivent à côté de la
  // source, qui reste intacte — celui-ci ne sert plus à rien.
  if (name.endsWith(".finalizing")) return true;
  if (name.endsWith(".part")) {
    const status = known.get(rel.slice(0, -".part".length));
    // Un `.part` en pause ou en attente EST la reprise : on n'y touche pas.
    return status === undefined ? removeOrphans : !KEEPS_PART.has(status);
  }
  return !known.has(rel) && removeOrphans;
}

/**
 * Balaie les dossiers d'item.
 *
 * Les identifiants viennent de la base — `FileStore` ne sait pas énumérer des
 * DOSSIERS, seulement des fichiers. Un dossier d'item dont toutes les lignes
 * ont disparu reste donc invisible ; c'est le prix de ce contrat, et la purge
 * s'en charge quand elle passe par le chemin normal.
 */
function sweepMediaDirs(
  db: DatabaseHandle,
  volume: Volume,
  known: ReadonlyMap<string, string>,
  busyItems: ReadonlySet<string>,
  removeOrphans: boolean,
): number {
  let removed = 0;
  for (const row of db.prepare("SELECT DISTINCT item_id FROM files").all()) {
    const itemId = text(row, "item_id");
    if (busyItems.has(itemId)) continue;
    const dir = `media/${itemId}`;
    // `listFiles` ne rend que des FICHIERS : le dossier `subs/` de l'item et
    // ses side-cars sont hors d'atteinte, et c'est heureux.
    for (const name of volume.files.listFiles(safeJoin(volume, dir))) {
      if (!isStale(name, `${dir}/${name}`, known, removeOrphans)) continue;
      volume.files.remove(safeJoin(volume, `${dir}/${name}`));
      removed += 1;
    }
  }
  return removed;
}
