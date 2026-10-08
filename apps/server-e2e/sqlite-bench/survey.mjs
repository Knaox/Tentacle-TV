// Relevé ANONYME d'un dump : volumes par table, forme des clés de `server_config`,
// nombre d'identifiants de comptes, et où traînent adresses IP, courriels et URL.
// Ne sort AUCUNE valeur : seulement des noms de tables/colonnes, des comptes et des formes.
//
//   node survey.mjs <dump.sql>
import { statements, parseInsert, decodeValue } from "./lib/dumpStream.mjs";
import { isUserIdColumn, ID_PATTERN } from "./lib/userIds.mjs";

const path = process.argv[2];
if (!path) throw new Error("usage : node survey.mjs <dump.sql>");

const tables = new Map();
const userIds = new Set();
const configShapes = [];
const hits = new Map(); // "table.colonne kind" → compte
const bump = (k) => hits.set(k, (hits.get(k) ?? 0) + 1);

function shapeOf(v) {
  if (v === null) return "null";
  if (typeof v === "object") return "number";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/^[0-9a-f]{32}$/i.test(v)) return "hex32";
  if (/^[0-9a-f]{64}$/i.test(v)) return "hex64";
  if (/^(true|false)$/.test(v)) return "bool";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
  if (/^[[{]/.test(v)) return `json(${v.length})`;
  return `text(${v.length})`;
}

const t0 = Date.now();
for await (const stmt of statements(path)) {
  const ins = parseInsert(stmt);
  if (!ins) continue;
  const t = tables.get(ins.table) ?? { rows: 0, bytes: 0 };
  t.rows += ins.rows.length;
  t.bytes += stmt.length;
  tables.set(ins.table, t);
  for (const row of ins.rows) {
    const values = row.map(decodeValue);
    values.forEach((v, idx) => {
      const col = ins.columns[idx];
      if (typeof v !== "string") return;
      if (isUserIdColumn(ins.table, col) && ID_PATTERN.test(v)) userIds.add(v.toLowerCase());
      if (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(v)) bump(`${ins.table}.${col} ipv4`);
      if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(v)) bump(`${ins.table}.${col} email`);
      if (/https?:\/\//i.test(v)) bump(`${ins.table}.${col} url`);
    });
    if (ins.table === "server_config") {
      const [key, value] = values;
      if (/^user_lang_/.test(key)) userIds.add(key.slice("user_lang_".length).toLowerCase());
      configShapes.push(`${key.replace(/[0-9a-f]{32}/gi, "<id>")} = ${shapeOf(value)}`);
    }
  }
}

console.log(`# relevé en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
let total = 0;
for (const [name, t] of [...tables].sort((a, b) => b[1].bytes - a[1].bytes)) {
  total += t.rows;
  console.log(`${name.padEnd(28)} ${String(t.rows).padStart(8)} lignes ${(t.bytes / 1e6).toFixed(2).padStart(9)} Mo`);
}
console.log(`TOTAL ${total} lignes, ${tables.size} tables avec données`);
console.log(`identifiants de comptes distincts : ${userIds.size}`);
console.log("# server_config (clés, forme des valeurs)");
for (const s of [...new Set(configShapes)].sort()) console.log(`  ${s}`);
console.log("# valeurs à surveiller (table.colonne genre → nombre)");
for (const [k, n] of [...hits].sort()) console.log(`  ${k} → ${n}`);
