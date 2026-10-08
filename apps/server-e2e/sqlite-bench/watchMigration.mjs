// Suit une bascule d'image du point de vue des CLIENTS, toutes les 200 ms :
// - /api/health (état de la base, avancement, temps restant, motif d'échec) ;
// - une route authentifiée ordinaire (ce que voit une application, à jour ou non ; `-` : /api/config) ;
// - /api/config → version (le moment où la 1.25 sert).
// Écrit la chronologie et un résumé : coupure vue par un client, durée de l'écran d'attente.
//
//   node watchMigration.mjs <base> <jeton> <sortie.json> [--until ready|failed] [--timeout 900]
//        [--kill-at <pourcentage> --kill-cmd "<commande>"]
// `--kill-at` lance la commande (podman kill …) dès que l'avancement l'atteint, puis s'arrête.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { call, databaseState } from "./lib/benchHttp.mjs";

const [base, token, out, ...rest] = process.argv.slice(2);
if (!base || !token || !out) throw new Error("usage : node watchMigration.mjs <base> <jeton> <sortie.json> [options]");
const opt = (name, fallback) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};
const until = opt("--until", "ready");
const timeoutS = Number(opt("--timeout", "900"));
const killAt = opt("--kill-at", null);
const killCmd = opt("--kill-cmd", null);

const t0 = Date.now();
const timeline = [];
let killed = null;
let lastKey = "";
let sawNonReady = false;

for (;;) {
  const t = Date.now() - t0;
  const [db, api, config] = await Promise.all([
    databaseState(base),
    // Sans jeton (« - ») : une route publique tient lieu de client (piles sans compte du banc).
    token === "-" ? call(base, "/api/config", { timeoutMs: 3000 }) : call(base, "/api/preferences", { token, timeoutMs: 3000 }),
    call(base, "/api/config", { timeoutMs: 3000 }),
  ]);
  const point = { t, health: db.http, state: db.state, percent: db.percent, eta: db.etaSeconds, reason: db.reason, api: api.status, version: config.json?.version ?? null };
  const key = `${point.health}|${point.state}|${point.reason}|${point.api}|${point.version}|${point.percent}`;
  if (key !== lastKey) {
    timeline.push(point);
    lastKey = key;
  }
  if (db.state !== "ready") sawNonReady = true;
  if (killAt !== null && killCmd && db.state === "migrating" && (db.percent ?? 0) >= Number(killAt)) {
    execSync(killCmd, { stdio: "ignore" });
    killed = { t: Date.now() - t0, percent: db.percent };
    break;
  }
  if (until === "failed" && db.state === "failed") break;
  if (until === "ready" && sawNonReady && db.state === "ready" && api.status === 200) break;
  if (t > timeoutS * 1000) break;
  await new Promise((r) => setTimeout(r, 200));
}

// Le résumé : ce qu'a vu un client.
const firstApiDown = timeline.find((p) => p.api !== 200);
const back = firstApiDown ? timeline.find((p) => p.t > firstApiDown.t && p.api === 200) : null;
const migrating = timeline.filter((p) => p.state === "migrating");
const summary = {
  endedAfterMs: Date.now() - t0,
  killed,
  apiDownAtMs: firstApiDown?.t ?? null,
  apiBackAtMs: back?.t ?? null,
  // La coupure vue par une application : de la première réponse non-200 à la première 200 qui suit
  // (à 200 ms près, le pas du relevé).
  clientCutMs: firstApiDown && back ? back.t - firstApiDown.t : null,
  waitingScreenFromMs: migrating[0]?.t ?? null,
  waitingScreenUntilMs: migrating.length ? migrating[migrating.length - 1].t : null,
  finalState: timeline[timeline.length - 1]?.state ?? null,
  finalReason: timeline[timeline.length - 1]?.reason ?? null,
  versions: [...new Set(timeline.map((p) => p.version).filter(Boolean))],
  apiStatuses: [...new Set(timeline.map((p) => p.api))],
};
writeFileSync(out, JSON.stringify({ summary, timeline }, null, 2), { mode: 0o600 });
console.log(JSON.stringify(summary));
