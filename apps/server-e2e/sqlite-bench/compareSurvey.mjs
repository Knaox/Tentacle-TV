// Compare deux relevés d'API (apiSurvey.mjs), AVANT et APRÈS. Ce qui sort est ANONYME : par
// route, le statut et le NOMBRE de champs ajoutés / retirés / changés, avec leurs chemins
// structurels (les identifiants d'éléments de liste remplacés par [*]) — jamais une valeur.
// Le détail complet (chemins réels) reste dans le dossier du banc, 0600.
//
//   node compareSurvey.mjs <avant.json> <après.json> <détail.json> [instables.json]   → markdown sur stdout
// `instables.json` : le détail d'une comparaison de DEUX relevés « avant » (même version) — une route
// qui y change d'elle-même (reco reconstruite, horloge…) est dite instable et n'est pas comptée.
import { readFileSync, writeFileSync } from "node:fs";

const [beforeFile, afterFile, detailFile, volatileFile] = process.argv.slice(2);
if (!beforeFile || !afterFile || !detailFile) throw new Error("usage : node compareSurvey.mjs <avant> <après> <détail>");
const before = JSON.parse(readFileSync(beforeFile, "utf8"));
const after = JSON.parse(readFileSync(afterFile, "utf8"));
const unstable = new Set(
  Object.entries(volatileFile ? JSON.parse(readFileSync(volatileFile, "utf8")) : {})
    .filter(([, d]) => d.statusBefore !== d.statusAfter || d.added.length || d.removed.length || d.changed.length)
    .map(([route]) => route),
);

/** Ce qui change d'un appel à l'autre sans rien dire des données : horloges, processus, état vivant. */
const VOLATILE = new Set([
  "timestamp", "bootId", "at", "now", "serverTime", "uptime", "uptimeSeconds", "generatedAt", "computedAt",
  "checkedAt", "lastCheckedAt", "lastSeen", "lastSeenAt", "lastUsedAt", "lastActiveAt", "fetchedAt",
  "pluginBackends", "jellyfin", "expiresIn",
]);
/** Ce que la 1.25 AJOUTE à dessein (additif) : signalé à part, jamais compté comme un écart. */
const EXPECTED_ADDITIONS = [/^public \/api\/config\.capabilities/, /^public \/api\/health\.database/];
const EXPECTED_CHANGES = [/^public \/api\/config\.version$/];

const KEYS = ["id", "Id", "key", "pluginId", "userId", "jellyfinUserId", "code", "tmdbId", "itemId", "rowKey", "name"];
function flatten(value, path, out) {
  if (Array.isArray(value)) {
    const key = value.length && typeof value[0] === "object" && value[0] ? KEYS.find((k) => value.every((v) => v && v[k] !== undefined)) : undefined;
    value.forEach((item, i) => flatten(item, `${path}[${key ? `${key}=${item[key]}` : i}]`, out));
    if (!value.length) out.set(path, "[]");
    return out;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => !VOLATILE.has(k));
    for (const k of keys) flatten(value[k], `${path}.${k}`, out);
    if (!keys.length) out.set(path, "{}");
    return out;
  }
  out.set(path, JSON.stringify(value));
  return out;
}
const anonymous = (path) => path.replace(/\[[^\]]*\]/g, "[*]");

const rows = [];
const detail = {};
let regressions = 0;
for (const route of Object.keys(before.results)) {
  const b = before.results[route];
  const a = after.results[route];
  if (!a) {
    rows.push(`| \`${route}\` | ${b.status} | absent | — |`);
    regressions++;
    continue;
  }
  const fb = flatten(b.body, route, new Map());
  const fa = flatten(a.body, route, new Map());
  const added = [...fa.keys()].filter((k) => !fb.has(k));
  const removed = [...fb.keys()].filter((k) => !fa.has(k));
  const changed = [...fb.keys()].filter((k) => fa.has(k) && fa.get(k) !== fb.get(k));
  const unexpected = (list, expected) => list.filter((p) => !expected.some((re) => re.test(p)));
  const realAdded = unexpected(added, EXPECTED_ADDITIONS);
  const realChanged = unexpected(changed, EXPECTED_CHANGES);
  detail[route] = { statusBefore: b.status, statusAfter: a.status, added, removed, changed };
  // Un ajout non prévu n'est pas forcément un défaut, mais il s'examine comme un écart.
  const same = b.status === a.status && !removed.length && !realChanged.length && !realAdded.length;
  if (!same && unstable.has(route)) {
    rows.push(`| \`${route}\` | ${b.status} | ${a.status} | instable d'elle-même sous la version d'avant (non comptée) |`);
    continue;
  }
  if (!same) regressions++;
  const note = same
    ? (added.length ? `identique (+${added.length} attendu(s))` : "identique")
    : [
        b.status !== a.status ? `statut ${b.status} → ${a.status}` : "",
        removed.length ? `${removed.length} retiré(s) : ${[...new Set(removed.map(anonymous))].slice(0, 4).join(", ")}` : "",
        realChanged.length ? `${realChanged.length} changé(s) : ${[...new Set(realChanged.map(anonymous))].slice(0, 4).join(", ")}` : "",
        realAdded.length ? `${realAdded.length} ajouté(s) : ${[...new Set(realAdded.map(anonymous))].slice(0, 4).join(", ")}` : "",
      ].filter(Boolean).join(" ; ");
  rows.push(`| \`${route}\` | ${b.status} | ${a.status} | ${note} |`);
}
writeFileSync(detailFile, JSON.stringify(detail, null, 2), { mode: 0o600 });
console.log(`Relevé de l'API : ${before.version ?? "?"} → ${after.version ?? "?"}, ${Object.keys(before.results).length} routes, ${regressions} écart(s) à examiner\n`);
console.log("| Route | Avant | Après | Comparaison |\n|---|---|---|---|");
console.log(rows.join("\n"));
process.exitCode = regressions ? 1 : 0;
