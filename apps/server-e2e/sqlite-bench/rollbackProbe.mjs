// Le retour arrière (§ 8.6) vu par l'API : une écriture faite par la 1.24 revenue sur
// MariaDB, puis, sous la 1.25, la divergence que l'administration doit dire, et après
// « Migrer à nouveau » l'écriture retrouvée dans SQLite.
//
//   node rollbackProbe.mjs <base> <jetons.json> write    → écrit (langue + une note) ; mémorise dans <jetons>.probe
//   node rollbackProbe.mjs <base> <jetons.json> status   → l'état de la migration vu par l'administration
//   node rollbackProbe.mjs <base> <jetons.json> check    → l'écriture de la 1.24 est-elle là ?
//   node rollbackProbe.mjs <base> <jetons.json> remigrate
import { readFileSync, writeFileSync } from "node:fs";
import { call, waitFor } from "./lib/benchHttp.mjs";

const [base, tokensFile, action] = process.argv.slice(2);
if (!base || !tokensFile || !action) throw new Error("usage : node rollbackProbe.mjs <base> <jetons.json> write|status|check|remigrate");
const tokens = JSON.parse(readFileSync(tokensFile, "utf8"));
const probeFile = `${tokensFile}.probe`;
// Un titre que la copie neutralisée ne note sûrement pas (identifiant TMDB hors d'usage).
const RATING = { mediaType: "movie", tmdbId: 999_999_001, score: 7 };

if (action === "write") {
  const current = await call(base, "/api/preferences/language", { token: tokens.user });
  const language = current.json?.language === "en" ? "fr" : "en";
  const put = await call(base, "/api/preferences/language", { method: "PUT", token: tokens.user, body: { language } });
  const rate = await call(base, "/api/ratings", { method: "PUT", token: tokens.user, body: RATING });
  if (put.status !== 200 || rate.status !== 200) throw new Error(`écriture : langue ${put.status}, note ${rate.status}`);
  writeFileSync(probeFile, JSON.stringify({ language }), { mode: 0o600 });
  console.log("écrit par la 1.24 : la langue de l'interface et une note");
} else if (action === "status") {
  const summary = await waitFor(async () => {
    const res = await call(base, "/api/admin/database/migration", { token: tokens.admin });
    return res.status === 200 && res.json?.sourceCheck ? res.json : null;
  }, { timeoutMs: 120_000, what: "contrôle de l'ancienne base" });
  console.log(JSON.stringify({ legacy: summary.legacy, sourceCheck: summary.sourceCheck, cache: summary.cache.phase }));
} else if (action === "check") {
  const { language } = JSON.parse(readFileSync(probeFile, "utf8"));
  const lang = await call(base, "/api/preferences/language", { token: tokens.user });
  const ratings = await call(base, "/api/ratings", { token: tokens.user });
  const list = Array.isArray(ratings.json) ? ratings.json : ratings.json?.ratings ?? [];
  const rated = list.some((r) => Number(r.tmdbId) === RATING.tmdbId && r.mediaType === RATING.mediaType);
  const ok = lang.json?.language === language && rated;
  console.log(JSON.stringify({ language: lang.json?.language === language, rating: rated }));
  process.exitCode = ok ? 0 : 1;
} else if (action === "remigrate") {
  const res = await call(base, "/api/admin/database/remigrate", { method: "POST", token: tokens.admin });
  if (res.status !== 200) throw new Error(`Migrer à nouveau : HTTP ${res.status}`);
  console.log("« Migrer à nouveau » demandé : le serveur redémarre");
} else {
  throw new Error(`action inconnue : ${action}`);
}
