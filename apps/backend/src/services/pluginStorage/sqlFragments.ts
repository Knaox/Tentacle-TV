import type { IntervalUnit, StorageSql, UpsertSpec } from "./types";

/**
 * Les tournures qu'une extension doit écrire comme le cœur (DECISION.md § 2) :
 * une date est un INTEGER, millisecondes epoch UTC — jamais `CURRENT_TIMESTAMP`,
 * `datetime('now')` ni une chaîne : en SQLite un TEXT est toujours plus grand
 * qu'un INTEGER, une date en texte fausserait toute comparaison.
 *
 * « Maintenant » se lit sur l'horloge de SQLite (`unixepoch('subsec')`,
 * SQLite ≥ 3.42). Le début du jour suit le fuseau du SERVEUR : il se calcule
 * ici et s'écrit en entier littéral — un nombre fabriqué ici, jamais une entrée.
 */

const NOW_MS = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";

const UNIT_MS: Record<IntervalUnit, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Un nom de table ou de colonne : jamais interpolé s'il n'est pas un identifiant simple. */
export function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`[pluginStorage] identifiant refusé : ${JSON.stringify(name)}`);
  return name;
}

/** Minuit du jour de `now`, heure locale du processus (changements d'heure compris). */
export function localMidnight(now: Date): Date {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

function integer(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error(`[pluginStorage] intervalle invalide : ${amount}`);
  return Math.trunc(amount);
}

function upsertSql(spec: UpsertSpec, now: string): string {
  const table = assertIdentifier(spec.table);
  const columns = spec.columns.map(assertIdentifier);
  const rows = Math.max(1, Math.trunc(spec.rows ?? 1));
  const tuple = `(${columns.map(() => "?").join(", ")})`;
  const insert = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${Array.from({ length: rows }, () => tuple).join(", ")}`;
  if (spec.conflict.length === 0) throw new Error(`[pluginStorage] upsert sur ${table} sans clé de conflit`);
  const target = spec.conflict.map(assertIdentifier).join(", ");
  const sets = spec.update.map((entry) => {
    if (typeof entry === "string") return `${assertIdentifier(entry)} = excluded.${entry}`;
    const [col, expr] = entry;
    if (expr !== "now") throw new Error(`[pluginStorage] expression d'upsert refusée : ${JSON.stringify(expr)}`);
    return `${assertIdentifier(col)} = ${now}`;
  });
  return sets.length > 0
    ? `${insert} ON CONFLICT(${target}) DO UPDATE SET ${sets.join(", ")}`
    : `${insert} ON CONFLICT(${target}) DO NOTHING`;
}

/** Une date relue : entier (ms), `Date`, ou texte d'une base d'avant ; `null` si illisible. */
export function readDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" || typeof value === "bigint") return new Date(Number(value));
  if (typeof value !== "string") return null;
  if (/^\d+$/.test(value)) return new Date(Number(value));
  // 'AAAA-MM-JJ HH:MM:SS' sans fuseau : UTC, comme l'écrivaient MariaDB et SQLite.
  const text = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createStorageSql(clock: () => Date = () => new Date()): StorageSql {
  return {
    now: () => NOW_MS,
    shiftedNow: (amount, unit) => `(${NOW_MS} + ${integer(amount) * UNIT_MS[unit]})`,
    startOfToday: () => String(localMidnight(clock()).getTime()),
    upsert: (spec) => upsertSql(spec, NOW_MS),
    insertIgnore: () => "INSERT OR IGNORE",
    dateParam: (date) => date.getTime(),
    readDate,
  };
}
