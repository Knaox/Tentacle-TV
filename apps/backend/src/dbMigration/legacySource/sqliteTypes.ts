import type { SourceColumn } from "./sourceSchema";

/**
 * Correspondance des types MariaDB → SQLite, pour les tables que la copie crée
 * ELLE-MÊME : celles des extensions (Vigie, ou une extension inconnue). Les
 * tables du cœur, elles, naissent des migrations du socle. La forme exacte fait
 * foi dans docs/sqlite/GENERIC-COPY.md.
 *
 * Les dates suivent la règle de tout le serveur (docs/sqlite/DECISION.md § 2) :
 * un INTEGER, millisecondes depuis 1970 en UTC — jamais du texte. La colonne est
 * DÉCLARÉE `DATETIME` : `$queryRaw` de Prisma la rend alors en `Date`.
 */
export type SqliteDeclaredType = "INTEGER" | "REAL" | "TEXT" | "BLOB" | "DATETIME";

const INTEGER_TYPES = new Set(["tinyint", "smallint", "mediumint", "int", "integer", "bigint", "year", "bit"]);
const REAL_TYPES = new Set(["float", "double", "real"]);
const NUMERIC_TYPES = new Set(["decimal", "numeric"]);
const DATETIME_TYPES = new Set(["datetime", "timestamp"]);
const BLOB_TYPES = new Set(["blob", "tinyblob", "mediumblob", "longblob", "binary", "varbinary"]);

export function isDateTimeColumn(col: SourceColumn): boolean {
  return DATETIME_TYPES.has(col.dataType);
}

export function declaredTypeOf(col: SourceColumn): SqliteDeclaredType {
  if (DATETIME_TYPES.has(col.dataType)) return "DATETIME";
  if (INTEGER_TYPES.has(col.dataType)) return "INTEGER";
  // DECIMAL → REAL, pas DECIMAL : `$queryRaw` rendrait un objet `Decimal`.
  if (REAL_TYPES.has(col.dataType) || NUMERIC_TYPES.has(col.dataType)) return "REAL";
  if (BLOB_TYPES.has(col.dataType)) return "BLOB";
  // char, varchar, *text, enum, set, json, date (YYYY-MM-DD), time : du texte.
  return "TEXT";
}

/** « Zéro » de MariaDB (`0000-00-00 …`) : une date qui n'en est pas une. */
export function isZeroDate(text: string): boolean {
  return /^0000-00-00/.test(text);
}

/**
 * `YYYY-MM-DD HH:MM:SS[.ffffff]` (texte rendu par le pilote, UTC) → millisecondes.
 * Les microsecondes au-delà de la milliseconde sont tronquées, comme Prisma le fait.
 * `null` pour une date « zéro » ou illisible.
 */
export function mariadbDateTimeToMs(text: string): number | null {
  if (isZeroDate(text)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) return null;
  const ms = m[7] ? Number(m[7].padEnd(6, "0").slice(0, 3)) : 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
}

/** Valeur lue par le pilote → valeur liable par `node:sqlite`. */
export function toSqliteValue(col: SourceColumn, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (isDateTimeColumn(col)) {
    const ms = mariadbDateTimeToMs(String(value));
    // Une date « zéro » dans une colonne NOT NULL garde l'epoch : listée au rapport.
    return ms ?? (col.nullable ? null : 0);
  }
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
  }
  if (NUMERIC_TYPES.has(col.dataType)) return Number(value);
  if (col.dataType === "bit" && Buffer.isBuffer(value)) return value.readUIntBE(0, Math.min(value.length, 6));
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

/**
 * Le défaut de la colonne en SQL SQLite, ou `null` quand il ne se traduit pas
 * (expression propre à MariaDB) : l'extension écrit alors la valeur elle-même,
 * comme elle le fait déjà sur une base neuve. Un défaut de date « maintenant »
 * devient l'entier courant, jamais `CURRENT_TIMESTAMP` (du texte).
 */
export function defaultClause(col: SourceColumn): string | null {
  const d = col.defaultValue;
  if (d === null || /^null$/i.test(d)) return null;
  if (/^current_timestamp(\(\d?\))?$/i.test(d) || /^now\(\d?\)$/i.test(d)) {
    return isDateTimeColumn(col) ? "(CAST(unixepoch('subsec') * 1000 AS INTEGER))" : null;
  }
  if (/^-?\d+(\.\d+)?$/.test(d)) return d;
  const quoted = /^'((?:[^']|'')*)'$/.exec(d);
  if (quoted) {
    if (isDateTimeColumn(col)) {
      const ms = mariadbDateTimeToMs(quoted[1].replace(/''/g, "'"));
      return ms === null ? null : String(ms);
    }
    return `'${quoted[1]}'`;
  }
  return null;
}
