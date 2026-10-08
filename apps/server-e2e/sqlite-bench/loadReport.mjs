// Le rapport ANONYME de la charge : par geste, le nombre d'appels et les latences p50 / p95 / p99,
// au repos puis pendant la copie du cache en fond ; les erreurs par statut ; SQLITE_BUSY au journal.
//
//   node loadReport.mjs <dossier-du-passage>   → markdown sur stdout
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8").trim() : null);
const out = [];
for (const [file, busy, title] of [
  ["load-settled.json", "busy-settled.txt", "Serveur en service, au repos"],
  ["load-during-copy.json", "busy-during-copy.txt", "Pendant la copie du cache TMDB en fond (½ cœur)"],
  ["load-slow-after-copy.json", "busy-slow-after-copy.txt", "Même ½ cœur, copie du cache finie (la part du ½ cœur seul)"],
]) {
  const text = read(file);
  if (!text) continue;
  const r = JSON.parse(text);
  out.push(`## ${title}`, "", `${r.workers} clients en parallèle, ${r.seconds} s : ${r.requests} appels ; ${read(busy) ?? ""}`);
  const errors = Object.entries(r.errors);
  out.push(`Erreurs : ${errors.length ? errors.map(([k, n]) => `${k} × ${n}`).join(", ") : "aucune"}`, "");
  out.push("| Geste | Appels | p50 | p95 | p99 |", "|---|---|---|---|---|");
  for (const [name, g] of Object.entries(r.gestures)) out.push(`| ${name} | ${g.count} | ${g.p50} ms | ${g.p95} ms | ${g.p99} ms |`);
  out.push("");
}
const cache = read("cache-at-end.txt");
if (cache) out.push(`Copie du cache à la fin de la charge : ${cache.replace(" ", ", ")} %`);
console.log(out.join("\n"));
