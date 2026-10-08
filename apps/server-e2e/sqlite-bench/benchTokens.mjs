// Les jetons du banc, pris sur la 1.24 AVANT la migration et GARDÉS pour après (« mêmes
// jetons avant et après ») : l'administrateur du Jellyfin du banc, le compte de test le plus
// fourni (le plus de notes et de « j'aime » dans la copie neutralisée), et une TV jumelée par
// ce compte (jeton d'appareil signé par Tentacle). Écrits en 0600, jamais affichés.
//
//   node benchTokens.mjs <base> <bench-users.json> <url-mariadb-hôte> <sortie.json> [pluginId]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { login, pairDevice } from "./lib/benchHttp.mjs";

const [base, usersFile, dbUrl, out, pluginId = "seer"] = process.argv.slice(2);
if (!base || !usersFile || !dbUrl || !out) throw new Error("usage : node benchTokens.mjs <base> <bench-users.json> <url-mariadb> <sortie.json>");
const bench = JSON.parse(readFileSync(usersFile, "utf8"));
const mariadb = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../backend/package.json"))("mariadb");

const target = new URL(dbUrl);
const conn = await mariadb.createConnection({
  host: target.hostname,
  port: Number(target.port || 3306),
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
  database: target.pathname.slice(1),
});
const ids = new Set(bench.users.map((u) => u.id.replace(/-/g, "").toLowerCase()));
const rows = await conn.query(
  `SELECT u, SUM(n) AS n FROM (
     SELECT jellyfinUserId AS u, COUNT(*) AS n FROM user_ratings GROUP BY jellyfinUserId
     UNION ALL SELECT jellyfinUserId AS u, COUNT(*) AS n FROM user_likes GROUP BY jellyfinUserId
   ) t GROUP BY u ORDER BY n DESC`,
);
await conn.end();
const richest = rows.map((r) => String(r.u).replace(/-/g, "").toLowerCase()).find((u) => ids.has(u));
const user = bench.users.find((u) => u.id.replace(/-/g, "").toLowerCase() === richest) ?? bench.users[0];

const admin = await login(base, bench.admin.name, bench.admin.password, "sqlbench-admin");
const member = await login(base, user.name, bench.userPassword, "sqlbench-user");
const device = await pairDevice(base, member.token, "Bench TV");
writeFileSync(out, JSON.stringify({ admin: admin.token, user: member.token, device, pluginId }, null, 2), { mode: 0o600 });
console.log(`jetons : administrateur, compte de test (${richest ? "le plus fourni" : "le premier"}), TV jumelée`);
