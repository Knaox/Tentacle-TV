import type { SourceTable } from "./sourceSchema";
import { declaredTypeOf, defaultClause } from "./sqliteTypes";

/**
 * Le DDL SQLite d'une table d'EXTENSION recopiée telle quelle : mêmes colonnes,
 * même clé primaire, mêmes index (uniques compris). Aucune donnée d'extension
 * ne se perd, même d'une extension que ce serveur ne connaît pas.
 *
 * Ce qui ne se traduit pas est laissé de côté, et c'est voulu : `ON UPDATE
 * CURRENT_TIMESTAMP` (l'extension écrit la date elle-même sur SQLite), les
 * `CHECK (json_valid(…))`, `ENGINE`, `COLLATE` (la casse se normalise à
 * l'entrée, docs/sqlite/DECISION.md § 6).
 */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Un entier AUTO_INCREMENT seul en clé devient l'alias de `rowid` : la suite des valeurs continue. */
function rowidAlias(table: SourceTable): string | null {
  if (table.primaryKey.length !== 1) return null;
  const col = table.columns.find((c) => c.name === table.primaryKey[0]);
  return col && declaredTypeOf(col) === "INTEGER" && /auto_increment/i.test(col.extra ?? "") ? col.name : null;
}

export function createTableSql(table: SourceTable): string {
  const alias = rowidAlias(table);
  const columns = table.columns.map((col) => {
    if (col.name === alias) return `${quoteIdent(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
    const parts = [quoteIdent(col.name), declaredTypeOf(col)];
    if (!col.nullable) parts.push("NOT NULL");
    const def = defaultClause(col);
    if (def !== null) parts.push(`DEFAULT ${def}`);
    return parts.join(" ");
  });
  if (table.primaryKey.length && !alias) {
    columns.push(`PRIMARY KEY (${table.primaryKey.map(quoteIdent).join(", ")})`);
  }
  return `CREATE TABLE ${quoteIdent(table.name)} (\n  ${columns.join(",\n  ")}\n)`;
}

/**
 * Les index. Leur nom est global en SQLite (par table en MariaDB) : un nom déjà
 * pris par une autre table reçoit le préfixe de la sienne.
 */
export function createIndexSql(table: SourceTable, takenNames: Set<string>): string[] {
  return table.indexes.map((index) => {
    let name = index.name;
    if (takenNames.has(name.toLowerCase())) name = `${table.name}_${index.name}`;
    takenNames.add(name.toLowerCase());
    const unique = index.unique ? "UNIQUE " : "";
    return `CREATE ${unique}INDEX ${quoteIdent(name)} ON ${quoteIdent(table.name)} (${index.columns.map(quoteIdent).join(", ")})`;
  });
}
