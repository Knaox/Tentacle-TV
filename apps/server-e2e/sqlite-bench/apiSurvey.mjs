// Le relevé de l'API d'un Tentacle, AVANT puis APRÈS la migration, avec les MÊMES jetons :
// comptes, appareils, Famille, recommandations, notifications, réglages de lecture,
// extensions et Vigie. Les réponses restent dans le dossier du banc (0600) : elles portent
// des données (neutralisées) ; seul le résumé de la comparaison (compareSurvey.mjs) sort.
//
//   node apiSurvey.mjs <base> <jetons.json> <sortie.json>
// jetons.json : { "admin": "…", "user": "…", "device": "…", "pluginId": "seer" }
import { readFileSync, writeFileSync } from "node:fs";
import { call } from "./lib/benchHttp.mjs";

const [base, tokensFile, out] = process.argv.slice(2);
if (!base || !tokensFile || !out) throw new Error("usage : node apiSurvey.mjs <base> <jetons.json> <sortie.json>");
const tokens = JSON.parse(readFileSync(tokensFile, "utf8"));
const plugin = tokens.pluginId ?? "seer";

/** [rôle, chemin] : ce qu'une application (à jour ou non), une TV et l'administration lisent. */
export const SURVEY = [
  ["public", "/api/config"],
  ["public", "/api/health"],
  // Le compte de test : ses réglages, sa Famille, ses goûts, ses notifications.
  ["user", "/api/preferences"],
  ["user", "/api/preferences/language"],
  ["user", "/api/push/preferences"],
  ["user", "/api/config/streaming"],
  ["user", "/api/config/autoplay"],
  ["user", "/api/family"],
  ["user", "/api/notifications"],
  ["user", "/api/notifications/unread-count"],
  ["user", "/api/ratings"],
  ["user", "/api/likes"],
  ["user", "/api/watchlist/auto-retired"],
  ["user", "/api/stats/me"],
  ["user", "/api/reco/rows"],
  ["user", "/api/reco/profile/status"],
  ["user", "/api/reco/requested"],
  ["user", "/api/tickets"],
  ["user", "/api/watch-together/invites"],
  ["user", "/api/theme"],
  ["user", "/api/leaderboard"],
  ["user", `/api/plugins/${plugin}/marks`],
  ["user", `/api/plugins/${plugin}/titles/access`],
  // La TV jumelée AVANT la migration : son jeton doit rester valable après.
  ["device", "/api/family"],
  ["device", "/api/preferences"],
  ["device", "/api/reco/rows"],
  // L'administration : comptes, appareils, invitations, Famille, extensions.
  ["admin", "/api/admin/users"],
  ["admin", "/api/pair/devices"],
  ["admin", "/api/invites"],
  ["admin", "/api/admin/family"],
  ["admin", "/api/admin/metadata"],
  ["admin", "/api/admin/downloads/users"],
  ["admin", "/api/tickets"],
  ["admin", "/api/plugins/active"],
  ["admin", "/api/plugins/sources"],
  ["admin", "/api/plugins"],
  ["admin", `/api/plugins/${plugin}/admin/users`],
  ["admin", `/api/plugins/${plugin}/stats`],
  ["admin", `/api/plugins/${plugin}/requests/stats`],
];

const results = {};
for (const [role, path] of SURVEY) {
  const token = role === "public" ? undefined : tokens[role];
  if (role !== "public" && !token) continue;
  const res = await call(base, path, { token, timeoutMs: 30_000 });
  results[`${role} ${path}`] = { status: res.status, body: res.json ?? (res.text ? { _text: res.text.slice(0, 200) } : null) };
}
const config = results["public /api/config"]?.body ?? {};
writeFileSync(out, JSON.stringify({ base, version: config.version ?? null, at: new Date().toISOString(), results }, null, 2), { mode: 0o600 });
const statuses = Object.values(results).reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
console.log(`relevé : ${Object.keys(results).length} routes, version ${config.version ?? "?"}, statuts ${JSON.stringify(statuses)}`);
