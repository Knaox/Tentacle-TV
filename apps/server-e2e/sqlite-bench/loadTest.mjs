// La charge (§ 8.7) : des écritures PARALLÈLES par l'API, comme plusieurs applications à la
// fois — notes, « j'aime », langue de l'interface (une ligne de server_config que tous
// réécrivent), lectures mêlées —, sur la base SQLite à UNE connexion. Mesure les latences par
// geste (p50 / p95 / p99) et les erreurs ; le scénario cherche ensuite SQLITE_BUSY au journal.
//
//   node loadTest.mjs <base> <jetons.json> <sortie.json> [--seconds 60] [--workers 16]
import { readFileSync, writeFileSync } from "node:fs";
import { call } from "./lib/benchHttp.mjs";

const [base, tokensFile, out, ...rest] = process.argv.slice(2);
if (!base || !tokensFile || !out) throw new Error("usage : node loadTest.mjs <base> <jetons.json> <sortie.json> [options]");
const opt = (name, fallback) => {
  const i = rest.indexOf(name);
  return i >= 0 ? Number(rest[i + 1]) : fallback;
};
const seconds = opt("--seconds", 60);
const workers = opt("--workers", 16);
const tokens = JSON.parse(readFileSync(tokensFile, "utf8"));
const rand = (n) => Math.floor(Math.random() * n);
// Des titres hors d'usage (identifiants TMDB très hauts) : la charge n'écrase aucune donnée réelle.
const tmdb = () => 990_000_000 + rand(500);

const GESTURES = {
  rate: () => call(base, "/api/ratings", { method: "PUT", token: tokens.user, body: { mediaType: "movie", tmdbId: tmdb(), score: 1 + rand(10) } }),
  like: () => call(base, "/api/likes", { method: "PUT", token: tokens.user, body: { mediaType: rand(2) ? "movie" : "series", tmdbId: tmdb() } }),
  language: () => call(base, "/api/preferences/language", { method: "PUT", token: tokens.user, body: { language: rand(2) ? "fr" : "en" } }),
  readPreferences: () => call(base, "/api/preferences", { token: tokens.user }),
  readRatings: () => call(base, "/api/ratings", { token: tokens.user }),
  readReco: () => call(base, "/api/reco/rows", { token: tokens.user }),
  deviceFamily: () => call(base, "/api/preferences", { token: tokens.device }),
};
const NAMES = Object.keys(GESTURES);

const samples = Object.fromEntries(NAMES.map((n) => [n, []]));
const errors = {};
const end = Date.now() + seconds * 1000;
async function worker() {
  while (Date.now() < end) {
    const name = NAMES[rand(NAMES.length)];
    const t = performance.now();
    const res = await GESTURES[name]();
    samples[name].push(performance.now() - t);
    if (res.status !== 200) {
      const key = `${name} ${res.status || res.error}`;
      errors[key] = (errors[key] ?? 0) + 1;
    }
  }
}
await Promise.all(Array.from({ length: workers }, worker));

const pct = (list, p) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};
const result = {
  seconds,
  workers,
  requests: Object.values(samples).reduce((n, l) => n + l.length, 0),
  errors,
  gestures: Object.fromEntries(NAMES.map((n) => [n, { count: samples[n].length, p50: pct(samples[n], 50), p95: pct(samples[n], 95), p99: pct(samples[n], 99) }])),
};
writeFileSync(out, JSON.stringify(result, null, 2), { mode: 0o600 });
console.log(JSON.stringify(result));
