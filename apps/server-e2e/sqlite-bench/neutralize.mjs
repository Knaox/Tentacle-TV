// Neutralise un export de PRODUCTION avant que le moindre Tentacle ne le voie (§ 7.2) :
// adresses vers le Jellyfin du banc, clés du banc, secrets régénérés, jetons factices de
// même forme, comptes remappés sur ceux du Jellyfin du banc dans TOUTES les tables
// (`user_lang_<id>` compris), noms et textes libres remplacés. L'original n'est que LU.
//
//   node neutralize.mjs <original.sql> <bench-users.json> <sortie.sql>
// Variables : BENCH_JELLYFIN_URL (défaut http://sqlbench-jellyfin:8096),
//             BENCH_PUBLIC_URL (défaut http://localhost:47480).
//
// Rien n'est affiché que des comptes. Le contrôle final cherche dans la sortie chaque
// secret, identifiant, hôte, adresse et nom d'origine : un seul trouvé et la sortie est
// SUPPRIMÉE (code 2).
import { createWriteStream, readFileSync, writeFileSync, chmodSync, unlinkSync, statSync } from "node:fs";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { statements, parseInsert, decodeValue, formatInsert } from "./lib/dumpStream.mjs";
import { createFaker, benchPinHash, dashed, escapeRe } from "./lib/fakes.mjs";
import { collect } from "./lib/collect.mjs";
import { createRewriter } from "./lib/rewrite.mjs";
import { CACHE_TABLES, BENCH_PIN } from "./lib/neutralizeRules.mjs";

const [src, benchFile, out] = process.argv.slice(2);
if (!src || !benchFile || !out) throw new Error("usage : node neutralize.mjs <original.sql> <bench-users.json> <sortie.sql>");
const bench = JSON.parse(readFileSync(benchFile, "utf8"));
bench.jellyfinUrl = process.env.BENCH_JELLYFIN_URL ?? "http://sqlbench-jellyfin:8096";
bench.publicUrl = process.env.BENCH_PUBLIC_URL ?? "http://localhost:47480";
const t0 = Date.now();
const lap = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

const found = await collect(src);
console.log(`passe 1 (${lap()}) : ${found.ids.length} comptes, ${found.sensitive.size} secrets, ` +
  `${found.hosts.size} hôtes, ${found.ips.size} adresses, ${found.deviceNames.size} appareils`);

const faker = createFaker();
const rewriter = createRewriter({ found, bench, faker, pinHash: await benchPinHash(BENCH_PIN) });

const ws = createWriteStream(out, { mode: 0o600 });
const write = async (s) => {
  if (!ws.write(s)) await once(ws, "drain");
};
await write("-- Copie NEUTRALISÉE pour le banc SQLite (sqlite-bench/neutralize.mjs). Ne quitte pas le banc.\n");
let rows = 0;
for await (const stmt of statements(src)) {
  const ins = parseInsert(stmt);
  if (!ins) {
    await write(stmt);
    continue;
  }
  ins.rows = ins.rows.map((r) => rewriter.row(ins.table, ins.columns, r));
  rows += ins.rows.length;
  await write(formatInsert(ins));
}
ws.end();
await once(ws, "finish");
chmodSync(out, 0o600);
console.log(`passe 2 (${lap()}) : ${rows} lignes réécrites, ${rewriter.idMap.size} comptes remappés, ${rewriter.nameCount} noms`);

// Contrôle 1 : aucun littéral sensible nulle part (grep -F : Aho-Corasick, rapide sur 800 Mo).
const patterns = [...found.sensitive, ...found.hosts];
for (const id of found.ids) patterns.push(id, dashed(id));
const patternFile = `${out}.leak-patterns`;
const grepCount = (args, list) => {
  if (!list.length) return 0;
  writeFileSync(patternFile, `${list.join("\n")}\n`, { mode: 0o600 });
  const r = spawnSync("grep", [...args, "-c", "-f", patternFile, out], { encoding: "utf8" });
  unlinkSync(patternFile);
  if (r.status > 1) throw new Error("grep a échoué");
  return Number(r.stdout.trim() || 0);
};
const literalHits = grepCount(["-F", "-i"], patterns) + grepCount(["-F", "-w"], [...found.ips]);

// Contrôle 2 : aucun nom de personne hors des tables de cache.
// Les noms d'appareils n'y sont pas : « Apple TV » est aussi un fournisseur ou un nom
// d'application. Le prénom d'un « iPhone de … », lui, est dans la liste des noms.
const names = [...found.namesById.values()].flatMap((s) => [...s]).filter((n) => n.length >= 3);
const nameRe = names.length
  ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "iu")
  : null;
const nameHits = new Map();
if (nameRe) {
  for await (const stmt of statements(out)) {
    const ins = parseInsert(stmt);
    if (!ins || CACHE_TABLES.has(ins.table)) continue;
    for (const raw of ins.rows) {
      raw.forEach((r, i) => {
        const v = decodeValue(r);
        if (typeof v === "string" && nameRe.test(v)) {
          const k = `${ins.table}.${ins.columns[i]}`;
          nameHits.set(k, (nameHits.get(k) ?? 0) + 1);
        }
      });
    }
  }
}

const size = (p) => `${(statSync(p).size / 1e6).toFixed(1)} Mo`;
console.log(`contrôle (${lap()}) : ${literalHits} ligne(s) avec un littéral d'origine, ` +
  `${[...nameHits.values()].reduce((a, b) => a + b, 0)} valeur(s) avec un nom d'origine`);
for (const [k, n] of nameHits) console.log(`  nom d'origine dans ${k} : ${n}`);
if (literalHits || nameHits.size) {
  unlinkSync(out);
  console.error("FUITE : la sortie est supprimée.");
  process.exit(2);
}
console.log(`sortie ${size(out)} (original ${size(src)}), 0600, aucune fuite détectée`);
