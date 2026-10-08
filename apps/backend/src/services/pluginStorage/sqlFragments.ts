import type { IntervalUnit, StorageDialect, StorageSql, UpsertSpec } from "./types";

/**
 * Les tournures non portables, écrites pour chaque moteur.
 *
 * MariaDB garde la main sur son horloge (`NOW(3)`), comme avant : les lignes
 * déjà écrites par `CURRENT_TIMESTAMP` sont dans SON fuseau, une date calculée
 * ici en UTC les décalerait. SQLite n'a pas de fuseau : l'instant se calcule
 * en JavaScript et s'écrit LITTÉRAL, au format que la base garde — un nombre
 * ou une chaîne fabriqués ici, jamais une entrée de l'utilisateur.
 *
 * Le début du jour suit le fuseau du SERVEUR des deux côtés : « maintenant,
 * moins le temps écoulé depuis minuit (heure locale du processus) ». MariaDB
 * le calcule sur sa propre horloge, quel que soit son fuseau.
 */

/** Comment SQLite garde une date — figé par la note de décision du socle. */
export type DateStorageFormat = "iso8601" | "epoch-ms";

const UNIT_MS: Record<IntervalUnit, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

const MYSQL_UNIT: Record<IntervalUnit, string> = {
  second: "SECOND", minute: "MINUTE", hour: "HOUR", day: "DAY",
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Un nom de table ou de colonne : jamais interpolé s'il n'est pas un identifiant simple. */
export function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`[pluginStorage] identifiant refusé : ${JSON.stringify(name)}`);
  return name;
}

/** Millisecondes écoulées depuis minuit, heure locale du processus. */
export function msSinceLocalMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return now.getTime() - midnight.getTime();
}

export function formatDate(date: Date, format: DateStorageFormat): string | number {
  return format === "epoch-ms" ? date.getTime() : date.toISOString();
}

function sqliteLiteral(date: Date, format: DateStorageFormat): string {
  const value = formatDate(date, format);
  return typeof value === "number" ? String(value) : `'${value}'`;
}

function integer(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error(`[pluginStorage] intervalle invalide : ${amount}`);
  return Math.trunc(amount);
}

function upsertSql(dialect: StorageDialect, spec: UpsertSpec): string {
  const table = assertIdentifier(spec.table);
  const columns = spec.columns.map(assertIdentifier);
  const insert = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  const proposed = (col: string) => (dialect === "mysql" ? `VALUES(${col})` : `excluded.${col}`);
  const sets = spec.update.map((entry) => {
    const [col, expr] = typeof entry === "string" ? [entry, `{new:${entry}}`] : entry;
    const resolved = expr.replace(/\{new:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => proposed(name));
    return `${assertIdentifier(col)} = ${resolved}`;
  });
  if (dialect === "mysql") {
    // Sans mise à jour, MariaDB réaffecte la clé à elle-même : l'équivalent de « ignorer ».
    const fallback = `${assertIdentifier(spec.conflict[0] ?? columns[0])} = ${assertIdentifier(spec.conflict[0] ?? columns[0])}`;
    return `${insert} ON DUPLICATE KEY UPDATE ${sets.length > 0 ? sets.join(", ") : fallback}`;
  }
  if (spec.conflict.length === 0) throw new Error(`[pluginStorage] upsert sur ${table} sans clé de conflit`);
  const target = spec.conflict.map(assertIdentifier).join(", ");
  return sets.length > 0
    ? `${insert} ON CONFLICT(${target}) DO UPDATE SET ${sets.join(", ")}`
    : `${insert} ON CONFLICT(${target}) DO NOTHING`;
}

export function createStorageSql(
  dialect: StorageDialect,
  format: DateStorageFormat,
  clock: () => Date = () => new Date(),
): StorageSql {
  if (dialect === "mysql") {
    return {
      now: () => "NOW(3)",
      shiftedNow: (amount, unit) => `DATE_ADD(NOW(3), INTERVAL ${integer(amount)} ${MYSQL_UNIT[unit]})`,
      startOfToday: () => `DATE_SUB(NOW(3), INTERVAL ${msSinceLocalMidnight(clock()) * 1000} MICROSECOND)`,
      upsert: (spec) => upsertSql(dialect, spec),
      insertIgnore: () => "INSERT IGNORE",
      dateParam: (date) => date,
    };
  }
  return {
    now: () => sqliteLiteral(clock(), format),
    shiftedNow: (amount, unit) => sqliteLiteral(new Date(clock().getTime() + integer(amount) * UNIT_MS[unit]), format),
    startOfToday: () => {
      const now = clock();
      return sqliteLiteral(new Date(now.getTime() - msSinceLocalMidnight(now)), format);
    },
    upsert: (spec) => upsertSql(dialect, spec),
    insertIgnore: () => "INSERT OR IGNORE",
    dateParam: (date) => formatDate(date, format),
  };
}
