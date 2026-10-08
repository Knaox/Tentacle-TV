import type { DatabaseSync } from "node:sqlite";
import { quoteIdent } from "../legacySource/extensionDdl";
import { MigrationFailure } from "../migrationErrors";
import { ChecksumAccumulator, checksumMismatch, type TableChecksum } from "./checksums";

/**
 * La vérification AVANT bascule, sur `tentacle.db.migrating` (fermé à Prisma) :
 *
 * 1. intégrité du fichier (`PRAGMA quick_check`) ;
 * 2. pour chaque table copiée, lignes et sommes de contrôle PAR COLONNE de ce que
 *    SQLite rend, comparées à ce que la copie a voulu écrire (dates en
 *    millisecondes, booléens en 0/1, texte exact) ;
 * 3. clés étrangères : une ligne orpheline (impossible sous les contraintes de
 *    MariaDB, possible sur une base sans elles) est retirée et comptée — MariaDB,
 *    elle, la garde.
 *
 * Un écart = échec : MariaDB reste intacte, la bascule n'a pas lieu.
 */
export interface TargetVerification {
  tablesChecked: number;
  foreignKeyOrphans: Record<string, number>;
}

function actualChecksum(db: DatabaseSync, table: string, columns: string[]): TableChecksum {
  const acc = new ChecksumAccumulator(columns);
  const stmt = db.prepare(`SELECT ${columns.map(quoteIdent).join(", ")} FROM ${quoteIdent(table)}`);
  stmt.setReadBigInts(true);
  for (const row of stmt.iterate() as Iterable<Record<string, unknown>>) {
    acc.add(columns.map((c) => row[c]));
  }
  return acc.result();
}

export function verifyTarget(db: DatabaseSync, expected: Record<string, TableChecksum>): TargetVerification {
  const check = db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
  const verdict = check.map((r) => Object.values(r)[0]).join(", ");
  if (verdict !== "ok") throw new MigrationFailure("verification_failed", `quick_check : ${verdict.slice(0, 200)}`);

  const foreignKeyOrphans: Record<string, number> = {};
  for (const row of db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string; rowid: number | bigint }>) {
    db.prepare(`DELETE FROM ${quoteIdent(row.table)} WHERE rowid = ?`).run(row.rowid);
    foreignKeyOrphans[row.table] = (foreignKeyOrphans[row.table] ?? 0) + 1;
  }

  let tablesChecked = 0;
  for (const [table, want] of Object.entries(expected)) {
    const columns = Object.keys(want.columns);
    const got = actualChecksum(db, table, columns);
    // Les orphelines retirées sont attendues en moins, et seulement elles.
    const removed = foreignKeyOrphans[table] ?? 0;
    const diff = removed ? (got.rows === want.rows - removed ? [] : ["(lignes)"]) : checksumMismatch(want, got);
    if (diff.length) {
      throw new MigrationFailure("verification_failed", `${table} : écart sur ${diff.join(", ")} (${got.rows}/${want.rows} lignes)`);
    }
    tablesChecked++;
  }
  return { tablesChecked, foreignKeyOrphans };
}
