// Joue l'assistant d'installation de Tentacle PAR SON API (`/api/setup/*`), comme le
// ferait la page — sans navigateur, donc rejouable — puis complète Jellyfin de ce
// que l'assistant ne sait pas faire (bibliothèque Musique, compte non administrateur).
//
//   node setup.mjs <comptes.json> [--libs-only]
//
// Comptes de TEST générés ici, écrits dans <comptes.json> (0600), jamais affichés.
// Idempotent : un banc déjà installé est relu, seules les bibliothèques sont reprises.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TENTACLE = "http://127.0.0.1:3471";
const JELLYFIN = "http://127.0.0.1:8471";
// L'origine sous laquelle le proto charge le front : l'assistant l'ajoute aux
// CorsHosts de Jellyfin à la fin (`completeRoute.ts`), pour la lecture directe.
const ORIGIN = TENTACLE;
const LIBRARIES = [
  { name: "Films", type: "movies", folder: "films" },
  { name: "Musique", type: "music", folder: "musique" },
  { name: "Séries", type: "tvshows", folder: "series" },
];
const AUTH = 'MediaBrowser Client="tentacle-cef-banc", Device="banc", DeviceId="tentacle-cef-banc", Version="1.0"';

const [out, flag] = process.argv.slice(2);
if (!out) throw new Error("usage : node setup.mjs <comptes.json> [--libs-only]");
const here = dirname(fileURLToPath(import.meta.url));
const mediaRoot = process.env.MEDIA_PATH ?? join(process.env.HOME, ".cache/tentacle-cef/media");

async function http(base, path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* texte brut */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, probe, timeoutMs = 180_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await probe(); if (v) return v; } catch { /* pas encore */ }
    await sleep(2_000);
  }
  throw new Error(`délai dépassé : ${label}`);
}

/** Un code d'installation neuf : celui des journaux ne sert qu'une fois. */
function setupCode() {
  const text = execFileSync(join(here, "banc.sh"), ["code"], { encoding: "utf8" });
  const codes = [...text.matchAll(/([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})/g)];
  if (!codes.length) throw new Error("aucun code d'installation rendu par `tentacle setup token`");
  return codes[codes.length - 1][1];
}

async function runWizard() {
  const admin = { name: "banc-admin", password: randomBytes(12).toString("base64url") };
  const { session } = await http(TENTACLE, "/api/setup/session", { method: "POST", body: { token: setupCode() } });
  const call = (path, opts = {}) =>
    http(TENTACLE, `/api/setup${path}`, { ...opts, headers: { "x-tentacle-setup": session, origin: ORIGIN } });
  const context = await call("/context");
  const url = context.jellyfin.url;
  // Le verrou du Jellyfin voisin suit le premier démarrage : l'attendre (`fullStack.e2e.ts`).
  await waitFor("Jellyfin voisin verrouillé", async () => (await call("/context")).jellyfin.claimed);
  await call("/jellyfin/select", { method: "POST", body: { url } });
  await call("/jellyfin/initialize", {
    method: "POST",
    body: { url, username: admin.name, password: admin.password, uiCulture: "fr", metadataCountry: "FR", metadataLanguage: "fr" },
  });
  // L'assistant ne crée que films/séries ; la musique passe par Jellyfin plus bas.
  await call("/jellyfin/libraries", {
    method: "POST",
    body: {
      libraries: [{ name: "Films", type: "movies", paths: ["/media/films"] }],
      metadataLanguage: "fr",
      metadataCountry: "FR",
    },
  });
  const done = await call("/complete", {
    method: "POST",
    body: { username: admin.name, password: admin.password, device: "Banc", jellyfinClientUrl: JELLYFIN },
  });
  if (!done?.success) throw new Error("l'assistant ne s'est pas fermé");
  return admin;
}

async function jellyfinToken(name, password) {
  const login = await http(JELLYFIN, "/Users/AuthenticateByName", {
    method: "POST",
    headers: { authorization: AUTH },
    body: { Username: name, Pw: password },
  });
  return login.AccessToken;
}

async function ensureLibraries(token) {
  const headers = { authorization: `${AUTH}, Token="${token}"` };
  const folders = await http(JELLYFIN, "/Library/VirtualFolders", { headers });
  for (const lib of LIBRARIES) {
    if (folders.some((f) => f.Name === lib.name)) continue;
    const q = new URLSearchParams({ name: lib.name, collectionType: lib.type, paths: `/media/${lib.folder}`, refreshLibrary: "true" });
    await http(JELLYFIN, `/Library/VirtualFolders?${q}`, { method: "POST", headers, body: { LibraryOptions: { EnableRealtimeMonitor: false } } });
    console.log(`bibliothèque ${lib.name} créée (/media/${lib.folder})`);
  }
  await http(JELLYFIN, "/Library/Refresh", { method: "POST", headers });
  console.log("analyse des bibliothèques relancée");
}

async function ensureUser(token, name) {
  const headers = { authorization: `${AUTH}, Token="${token}"` };
  const users = await http(JELLYFIN, "/Users", { headers });
  if (users.some((u) => u.Name === name)) return null;
  const password = randomBytes(12).toString("base64url");
  await http(JELLYFIN, "/Users/New", { method: "POST", headers, body: { Name: name, Password: password } });
  return { name, password };
}

const saved = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
await waitFor("Tentacle répond", () => http(TENTACLE, "/api/setup/status"));
const status = await http(TENTACLE, "/api/setup/status");
let accounts = saved;
if (flag !== "--libs-only" && status.setupOpen) {
  const admin = await runWizard();
  accounts = { tentacle: TENTACLE, jellyfin: JELLYFIN, admin };
  writeFileSync(out, JSON.stringify(accounts, null, 2));
  chmodSync(out, 0o600);
  console.log(`assistant joué : administrateur de test noté dans ${out}`);
}
if (!accounts?.admin) throw new Error(`banc installé mais aucun compte noté dans ${out} : banc.sh reset puis setup`);
// Les dossiers de médias appartiennent aux sessions vidéo-HDR et octave ; un dossier
// vide suffit à Jellyfin pour accepter la bibliothèque, il se remplit plus tard.
for (const lib of LIBRARIES) {
  const dir = join(mediaRoot, lib.folder);
  if (!existsSync(dir)) console.warn(`⚠️ ${dir} absent : bibliothèque ${lib.name} vide tant qu'il manque`);
}
const token = await jellyfinToken(accounts.admin.name, accounts.admin.password);
await ensureLibraries(token);
if (!accounts.user) {
  const user = await ensureUser(token, "banc-user");
  if (user) {
    accounts.user = user;
    writeFileSync(out, JSON.stringify(accounts, null, 2));
    chmodSync(out, 0o600);
    console.log("compte de test non administrateur « banc-user » créé et noté");
  }
}
console.log(`banc prêt : ${TENTACLE} (front + API), Jellyfin ${JELLYFIN}`);
