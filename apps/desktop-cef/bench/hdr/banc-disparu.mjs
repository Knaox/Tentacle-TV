// Prérequis de la robustesse du pont : « Banc Disparu (2026) » doit être INDEXÉ par Jellyfin
// alors que son fichier n'existe plus (erreur de lecture attendue). Une analyse de bibliothèque
// le fait disparaître de l'index ; ce script le recrée : copie d'un film du banc, analyse, attente
// de l'indexation, puis retrait du fichier (surveillance temps réel coupée par setup.mjs).
// Ne fait rien si l'élément est déjà indexé.
//
//   node bench/hdr/banc-disparu.mjs
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
const AUTH = 'MediaBrowser Client="tentacle-cef-banc", Device="banc", DeviceId="tentacle-cef-banc", Version="1.0"';
const NAME = "Banc Disparu (2026)";
const films = join(cache, "media/films");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, {
  method: "POST", headers: { "content-type": "application/json", authorization: AUTH },
  body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }),
})).json();
const headers = { authorization: `${AUTH}, Token="${login.AccessToken}"` };
async function indexed() {
  const q = new URLSearchParams({ Recursive: "true", IncludeItemTypes: "Movie", SearchTerm: NAME });
  const res = await (await fetch(`${accounts.jellyfin}/Items?${q}`, { headers })).json();
  return (res.Items ?? []).some((i) => i.Name === NAME);
}

if (await indexed()) { console.log(`✅ ${NAME} déjà indexé`); process.exit(0); }
const dir = join(films, NAME);
const file = join(dir, `${NAME}.mkv`);
mkdirSync(dir, { recursive: true });
copyFileSync(join(films, "Banc Pistes SDR (2026)", "Banc Pistes SDR (2026).mkv"), file);
await fetch(`${accounts.jellyfin}/Library/Refresh`, { method: "POST", headers });
let ok = false;
for (let i = 0; i < 60 && !ok; i++) { await sleep(2000); ok = await indexed(); }
rmSync(file);
console.log(`${ok ? "✅" : "❌"} ${NAME} indexé puis fichier retiré — fichier présent : ${existsSync(file)}`);
process.exit(ok ? 0 : 1);
