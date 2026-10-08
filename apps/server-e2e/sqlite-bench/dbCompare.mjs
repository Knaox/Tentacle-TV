// Compare la MariaDB SOURCE et une COPIE de la tentacle.db migrée, sans rien du code de la
// migration (un regard indépendant) : par table, les lignes des deux côtés, celles qui
// manquent, celles en trop, et le nombre d'écarts PAR COLONNE — jamais une valeur.
// Normalisation : DATETIME/TIMESTAMP (lus en UTC) → millisecondes, booléens 0/1, entiers et
// décimaux en nombre, binaires en hexadécimal, chaînes telles quelles.
//
//   node dbCompare.mjs <url-mariadb> <copie-tentacle.db> <sortie.json>   → résumé markdown sur stdout
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const [url, sqlitePath, out] = process.argv.slice(2);
if (!url || !sqlitePath || !out) throw new Error("usage : node dbCompare.mjs <url-mariadb> <tentacle.db> <sortie.json>");
// Le pilote du backend (même version que la migration, mais pas son code).
const requireBackend = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../backend/package.json"));
const mariadb = requireBackend("mariadb");

const SQLITE_ONLY = new Set(["core_migrations", "plugin_migrations", "sqlite_sequence"]);
const target = new URL(url);
const conn = await mariadb.createConnection({
  host: target.hostname,
  port: Number(target.port || 3306),
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
  database: target.pathname.slice(1),
  dateStrings: true,
  autoJsonMap: false,
  bigIntAsNumber: false,
  decimalAsNumber: false,
  timezone: "+00:00",
});
await conn.query("SET SESSION TRANSACTION READ ONLY");
await conn.query("SET time_zone = '+00:00'");
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

const q = (name) => `\`${name.replace(/`/g, "``")}\``;
const sq = (name) => `"${name.replace(/"/g, '""')}"`;

function norm(value, type) {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Buffer.from(value).toString("hex");
  if (/^(datetime|timestamp)$/i.test(type ?? "")) {
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (/^0000-00-00/.test(value)) return null;
    const ms = Date.parse(`${String(value).replace(" ", "T")}Z`);
    return Number.isNaN(ms) ? `?${value}` : String(ms);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return String(value);
  if (/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double)$/i.test(type ?? "") && value !== "" && !Number.isNaN(Number(value))) {
    return String(Number(value));
  }
  return String(value);
}
const hashRow = (values) => createHash("sha1").update(JSON.stringify(values)).digest("hex");

const sourceTables = (await conn.query(
  "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
)).map((r) => r.t);
const targetTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);

const report = { tables: {}, onlyInSource: sourceTables.filter((t) => !targetTables.includes(t)).sort(), onlyInTarget: [] };
for (const table of targetTables.sort()) {
  if (SQLITE_ONLY.has(table)) continue;
  if (!sourceTables.includes(table)) {
    report.onlyInTarget.push(table);
    continue;
  }
  const srcCols = await conn.query(
    "SELECT COLUMN_NAME AS c, DATA_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
    [table],
  );
  const info = sqlite.prepare(`PRAGMA table_info(${sq(table)})`).all();
  const targetCols = new Map(info.map((c) => [c.name, c]));
  const typeOf = new Map(srcCols.map((c) => [c.c, c.t]));
  const common = srcCols.map((c) => c.c).filter((c) => targetCols.has(c));
  const pk = info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name).filter((c) => typeOf.has(c));
  const entry = {
    rowsSource: 0, rowsTarget: 0, missing: 0, extra: 0, differing: 0, columns: {},
    columnsOnlyInSource: srcCols.map((c) => c.c).filter((c) => !targetCols.has(c)),
    columnsOnlyInTarget: info.map((c) => c.name).filter((c) => !typeOf.has(c)),
  };
  // Côté SQLite : clé → empreinte (≈ 100 000 lignes au plus : tient en mémoire).
  const keyOf = (row) => JSON.stringify(pk.length ? pk.map((c) => norm(row[c], typeOf.get(c))) : common.map((c) => norm(row[c], typeOf.get(c))));
  const targetRows = new Map();
  for (const row of sqlite.prepare(`SELECT ${common.map(sq).join(", ")} FROM ${sq(table)}`).iterate()) {
    entry.rowsTarget++;
    const key = keyOf(row);
    const values = common.map((c) => norm(row[c], typeOf.get(c)));
    const seen = targetRows.get(key);
    targetRows.set(key, seen ? { ...seen, count: seen.count + 1 } : { hash: hashRow(values), count: 1 });
  }
  const stream = conn.queryStream({ sql: `SELECT ${common.map(q).join(", ")} FROM ${q(table)}`, rowsAsArray: false });
  for await (const row of stream) {
    entry.rowsSource++;
    const key = keyOf(row);
    const found = targetRows.get(key);
    if (!found) {
      entry.missing++;
      continue;
    }
    const values = common.map((c) => norm(row[c], typeOf.get(c)));
    if (found.hash !== hashRow(values)) {
      entry.differing++;
      if (pk.length) {
        const where = pk.map((c) => `${sq(c)} IS ?`).join(" AND ");
        const target = sqlite.prepare(`SELECT ${common.map(sq).join(", ")} FROM ${sq(table)} WHERE ${where}`).get(...pk.map((c) => row[c] === null ? null : targetValue(row[c], targetCols.get(c), typeOf.get(c))));
        for (const c of common) {
          if (!target || norm(target[c], typeOf.get(c)) !== norm(row[c], typeOf.get(c))) entry.columns[c] = (entry.columns[c] ?? 0) + 1;
        }
      }
    }
    if (found.count > 1) found.count--;
    else targetRows.delete(key);
  }
  entry.extra = [...targetRows.values()].reduce((n, r) => n + r.count, 0);
  report.tables[table] = entry;
}
sqlite.close();
await conn.end();

/** La valeur de clé telle que SQLite la range (dates en ms), pour relire la ligne cible. */
function targetValue(value, column, type) {
  const n = norm(value, type);
  return /INT|REAL|NUM/i.test(column?.type ?? "") && n !== null && !Number.isNaN(Number(n)) ? Number(n) : n;
}

writeFileSync(out, JSON.stringify(report, null, 2), { mode: 0o600 });
const tables = Object.entries(report.tables);
const bad = tables.filter(([, e]) => e.missing || e.extra || e.differing || e.columnsOnlyInSource.length);
console.log(`Base : ${tables.length} tables comparées, ${tables.reduce((n, [, e]) => n + e.rowsSource, 0)} lignes source, ${bad.length} table(s) avec écart`);
console.log(`Source seulement : ${report.onlyInSource.join(", ") || "—"} · Cible seulement : ${report.onlyInTarget.join(", ") || "—"}\n`);
console.log("| Table | Source | SQLite | Manquantes | En trop | Lignes différentes | Colonnes |\n|---|---|---|---|---|---|---|");
for (const [name, e] of tables) {
  const cols = Object.entries(e.columns).map(([c, n]) => `${c}:${n}`).concat(e.columnsOnlyInSource.map((c) => `${c}:absente`)).join(", ");
  console.log(`| ${name} | ${e.rowsSource} | ${e.rowsTarget} | ${e.missing} | ${e.extra} | ${e.differing} | ${cols || "—"} |`);
}
