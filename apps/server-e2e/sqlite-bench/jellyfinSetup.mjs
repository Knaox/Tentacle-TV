// Prépare le Jellyfin du banc : assistant de Jellyfin, un administrateur, N comptes,
// les bibliothèques sur les vrais fichiers du banc, une clé d'API « Tentacle ».
// Écrit `bench-users.json` (0600) : ce que la neutralisation lie aux comptes du dump.
//
//   node jellyfinSetup.mjs <url-publiée> <nombre-de-comptes> <sortie.json>
// Idempotent : un Jellyfin déjà prêt est relu, les comptes manquants sont créés.
import { writeFileSync, chmodSync, existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";

const [url, countArg, out] = process.argv.slice(2);
if (!url || !countArg || !out) throw new Error("usage : node jellyfinSetup.mjs <url> <n> <sortie.json>");
const count = Number(countArg);
const previous = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
const adminName = "bench-admin";
const adminPassword = previous?.admin.password ?? crypto.randomBytes(12).toString("hex");
const userPassword = previous?.userPassword ?? crypto.randomBytes(9).toString("hex");
const AUTH = 'MediaBrowser Client="sqlbench", Device="sqlbench", DeviceId="sqlbench-setup", Version="1.0"';

async function call(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json", Authorization: token ? `${AUTH}, Token="${token}"` : AUTH };
  const res = await fetch(`${url}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      const info = await call("/System/Info/Public");
      // Le serveur d'attente de 10.11 répond 200 sans `Id` pendant son démarrage.
      if (info?.Id) return info;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Jellyfin du banc injoignable");
}

const info = await waitReady();
if (!info.StartupWizardCompleted) {
  await call("/Startup/Configuration", { method: "POST", body: { UICulture: "fr-FR", MetadataCountryCode: "FR", PreferredMetadataLanguage: "fr" } });
  await call("/Startup/User");
  await call("/Startup/User", { method: "POST", body: { Name: adminName, Password: adminPassword } });
  await call("/Startup/RemoteAccess", { method: "POST", body: { EnableRemoteAccess: true, EnableAutomaticPortMapping: false } });
  await call("/Startup/Complete", { method: "POST" });
}
const login = await call("/Users/AuthenticateByName", { method: "POST", body: { Username: adminName, Pw: adminPassword } });
const token = login.AccessToken;

const existing = await call("/Users", { token });
const users = [];
for (let n = 1; n <= count; n++) {
  const name = `bench${String(n).padStart(2, "0")}`;
  let user = existing.find((u) => u.Name === name);
  if (!user) user = await call("/Users/New", { method: "POST", token, body: { Name: name, Password: userPassword } });
  users.push({ id: user.Id.replace(/-/g, "").toLowerCase(), name });
}

const folders = await call("/Library/VirtualFolders", { token });
for (const [name, type, path] of [["Films", "movies", "/media/films"], ["Séries", "tvshows", "/media/series"]]) {
  if (folders.some((f) => f.Name === name)) continue;
  const q = new URLSearchParams({ name, collectionType: type, paths: path, refreshLibrary: "true" });
  await call(`/Library/VirtualFolders?${q}`, { method: "POST", token, body: { LibraryOptions: { EnableRealtimeMonitor: true } } });
}

const keys = await call("/Auth/Keys", { token });
let apiKey = keys.Items.find((k) => k.AppName === "Tentacle")?.AccessToken;
if (!apiKey) {
  await call("/Auth/Keys?app=Tentacle", { method: "POST", token });
  apiKey = (await call("/Auth/Keys", { token })).Items.find((k) => k.AppName === "Tentacle").AccessToken;
}

const admin = { id: login.User.Id.replace(/-/g, "").toLowerCase(), name: adminName, password: adminPassword };
writeFileSync(out, JSON.stringify({ jellyfinVersion: info.Version, admin, users, userPassword, apiKey }, null, 2));
chmodSync(out, 0o600);
console.log(`Jellyfin ${info.Version} prêt : 1 admin + ${users.length} comptes, clé d'API posée`);
