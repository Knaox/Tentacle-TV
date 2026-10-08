// Installe ou met à jour Vigie depuis le registre LOCAL du banc, par l'API d'administration
// (ce que fait le bouton de la page des extensions), puis attend le redémarrage du serveur
// quand l'extension l'exige (nouvel identifiant de processus dans /api/health).
//
//   node vigieInstall.mjs <base> <jetons.json> <url-du-registre> install <version>
//   node vigieInstall.mjs <base> <jetons.json> <url-du-registre> update
//   node vigieInstall.mjs <base> <jetons.json> <url-du-registre> marketplace   → ce que le serveur PROPOSE
//   node vigieInstall.mjs <base> <jetons.json> - state                        → version et module serveur
import { readFileSync } from "node:fs";
import { call, waitFor } from "./lib/benchHttp.mjs";

const [base, tokensFile, registryUrl, action, version] = process.argv.slice(2);
if (!base || !tokensFile || !registryUrl || !action) throw new Error("usage : node vigieInstall.mjs <base> <jetons.json> <registre> install|update|marketplace [version]");
const { admin, pluginId = "seer" } = JSON.parse(readFileSync(tokensFile, "utf8"));

async function source() {
  const list = await call(base, "/api/plugins/sources", { token: admin });
  if (list.status !== 200) throw new Error(`sources : HTTP ${list.status}`);
  const found = list.json.find((s) => s.url === registryUrl);
  if (found) return found;
  const added = await call(base, "/api/plugins/sources", { method: "POST", token: admin, body: { url: registryUrl, name: "Registre du banc" }, timeoutMs: 60_000 });
  if (added.status !== 200) throw new Error(`source ajoutée : HTTP ${added.status}`);
  return added.json;
}

async function bootId() {
  return (await call(base, "/api/health", { timeoutMs: 3000 })).json?.bootId ?? null;
}

async function afterRestart(previous, restart) {
  if (!restart) return;
  await waitFor(async () => {
    const id = await bootId();
    return id && id !== previous;
  }, { timeoutMs: 180_000, what: "redémarrage après l'extension" });
}

if (action === "state") {
  // L'extension vue par l'administration : version installée et état de son module serveur.
  const installed = await call(base, "/api/plugins", { token: admin });
  const entry = (installed.json ?? []).find((p) => p.pluginId === pluginId);
  console.log(JSON.stringify(entry ? { version: entry.version, serverModule: entry.serverModule ?? null } : null));
  process.exit(0);
}
const src = await source();
if (action === "marketplace") {
  const market = await call(base, "/api/plugins/marketplace", { token: admin, timeoutMs: 60_000 });
  const offered = (Array.isArray(market.json) ? market.json : market.json?.plugins ?? []).filter((p) => (p.pluginId ?? p.id) === pluginId);
  console.log(JSON.stringify(offered.map((p) => ({ version: p.version ?? p.latestVersion, incompatible: p.incompatible ?? false, newerRequires: p.newerRequires ?? null }))));
} else if (action === "install") {
  const before = await bootId();
  const res = await call(base, "/api/plugins/install", { method: "POST", token: admin, body: { pluginId, version, sourceId: src.id }, timeoutMs: 120_000 });
  if (res.status !== 200) throw new Error(`installation : HTTP ${res.status} ${res.json?.message ?? ""}`);
  await afterRestart(before, res.json?.restartScheduled === true);
  console.log(`Vigie ${version} installé`);
} else if (action === "update") {
  const installed = await call(base, "/api/plugins", { token: admin });
  const entry = (installed.json ?? []).find((p) => p.pluginId === pluginId);
  if (!entry) throw new Error("Vigie n'est pas installé");
  const before = await bootId();
  const res = await call(base, `/api/plugins/${encodeURIComponent(entry.id)}/update`, { method: "POST", token: admin, timeoutMs: 120_000 });
  if (res.status !== 200) throw new Error(`mise à jour : HTTP ${res.status} ${res.json?.message ?? ""}`);
  await afterRestart(before, res.json?.restartScheduled === true);
  console.log(`Vigie ${entry.version} → ${res.json?.version ?? "?"}`);
} else {
  throw new Error(`action inconnue : ${action}`);
}
