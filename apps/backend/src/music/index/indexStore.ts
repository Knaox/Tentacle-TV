/**
 * Octave — les ÉCRITURES de l'index local (`music_items` + `music_fts`), par
 * Prisma en SQL brut : le processus a Prisma ouvert sur tentacle.db, jamais
 * `node:sqlite` ici (CLAUDE.md, « Base de données »).
 *
 * Chaque lot écrit les deux tables dans UNE transaction : la recherche ne voit
 * jamais un titre que la table ne connaît pas, ni l'inverse. La table FTS5 est
 * autonome (pas de contenu externe) et tenue ici, sans déclencheur.
 *
 * Générations : un passage COMPLET pose une génération nouvelle sur tout ce
 * qu'il voit, puis retire ce qui est resté à l'ancienne (disparu de Jellyfin
 * pendant que personne n'écoutait ses évènements).
 */

import { getPrisma } from "../../services/db";
import type { IndexRow } from "./indexTypes";
import { COLUMNS, ftsRowid, ftsValues, rowValues, type SqlValue } from "./rowCodec";

/** 24 colonnes × 200 lignes : loin sous la limite de variables de SQLite. */
const BATCH = 200;

// La ReplayGain relue est gardée tant que le fichier ne change pas (même taille) ;
// un fichier remplacé (mise à niveau) la fait relire.
const UPDATE_SET = [
  `"replayGainJson" = CASE WHEN "sizeBytes" IS excluded."sizeBytes" THEN "replayGainJson" ELSE NULL END`,
  ...COLUMNS.filter((c) => c !== "id").map((c) => `"${c}" = excluded."${c}"`),
].join(", ");

/** Les colonnes nommées, TOUTES (dates comprises, liées en `Date` : docs/sqlite/DECISION.md § 2). */
const COLUMN_LIST = COLUMNS.map((c) => `"${c}"`).join(", ");

/** « (?, ?, …), (?, ?, …) » : des marques, aucune valeur. */
function placeholders(rows: number, columns: number): string {
  const one = `(${new Array(columns).fill("?").join(", ")})`;
  return new Array(rows).fill(one).join(", ");
}

export async function upsertRows(rows: IndexRow[], generation: number, now = new Date()): Promise<void> {
  const prisma = getPrisma();
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values: SqlValue[] = batch.flatMap((row) => rowValues(row, now, generation));
    const fts: SqlValue[] = batch.flatMap((row) => ftsValues(row));
    const rowids = batch.map((row) => ftsRowid(row.id));
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `INSERT INTO "music_items" (${COLUMN_LIST}) VALUES ${placeholders(batch.length, COLUMNS.length)}
         ON CONFLICT ("id") DO UPDATE SET ${UPDATE_SET}`,
        ...values,
      ),
      prisma.$executeRawUnsafe(`DELETE FROM "music_fts" WHERE rowid IN (${rowids.map(() => "?").join(", ")})`, ...rowids),
      prisma.$executeRawUnsafe(
        `INSERT INTO "music_fts" (rowid, "id", "kind", "name", "artists", "album") VALUES ${placeholders(batch.length, 6)}`,
        ...fts,
      ),
    ]);
  }
}

/** Retire des éléments (supprimés de Jellyfin) ; rend ceux que l'index connaissait. */
export async function removeRows(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const prisma = getPrisma();
  const known: string[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const present = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "music_items" WHERE "id" IN (${batch.map(() => "?").join(", ")})`,
      ...batch,
    );
    if (present.length === 0) continue;
    const gone = present.map((r) => r.id);
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`DELETE FROM "music_items" WHERE "id" IN (${gone.map(() => "?").join(", ")})`, ...gone),
      prisma.$executeRawUnsafe(`DELETE FROM "music_fts" WHERE rowid IN (${gone.map(() => "?").join(", ")})`, ...gone.map(ftsRowid)),
    ]);
    known.push(...gone);
  }
  return known;
}

export async function currentGeneration(): Promise<number> {
  const rows = await getPrisma().$queryRawUnsafe<{ g: number | bigint | null }[]>(`SELECT MAX("generation") AS g FROM "music_items"`);
  return Number(rows[0]?.g ?? 0);
}

/** Fin d'un passage complet : ce qui n'a pas été revu part. Rend les identifiants retirés. */
export async function dropOlderThan(generation: number): Promise<string[]> {
  const stale = await getPrisma().$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_items" WHERE "generation" < ?`,
    generation,
  );
  return removeRows(stale.map((r) => r.id));
}

/** La ReplayGain lue des tags, gardée pour les sources suivantes (`{}` : rien dans le fichier). */
export async function saveReplayGain(id: string, json: string): Promise<void> {
  await getPrisma().$executeRawUnsafe(`UPDATE "music_items" SET "replayGainJson" = ? WHERE "id" = ?`, json, id);
}
