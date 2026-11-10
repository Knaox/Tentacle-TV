#!/usr/bin/env node
// Recette écran par écran (axe navigateur) : parcourt les routes du front sous Tentacle CEF et,
// pour chacune, relève ce qu'un écart avec Electron laisserait voir — exceptions et erreurs de
// console, requêtes en échec, canaux refusés par le shim (« canal refuse »), texte d'erreur à
// l'écran — plus une capture. Rien n'est cliqué ici : les gestes ont leurs propres sondes.
//   node tests/recette/ecrans.mjs <port> [routes…]      (sans route : la liste ci-dessous)
// Sortie : ~/.cache/tentacle-cef/build/recette-navigateur/<horodatage>/{tableau.tsv, *.jpg}
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

const [port = "9425", ...only] = process.argv.slice(2);
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const stamp = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "");
const out = join(cache, "build/recette-navigateur", stamp);
mkdirSync(out, { recursive: true });

// Les écrans du bureau (App.tsx, OctaveApp.tsx). `{media}`, `{person}`, `{library}`… : premiers
// liens trouvés sur l'accueil et dans les bibliothèques.
const ROUTES = only.length ? only : [
  "/", "/libraries", "/library/{library}", "/media/{media}", "/person/{person}", "/watchlist",
  "/favorites", "/recommendations", "/recommendations/refine", "/swipe", "/stats", "/search",
  "/downloads", "/on-device", "/support", "/help/trailers",
  "/settings", "/settings/appearance", "/settings/personalization", "/settings/security",
  "/settings/family", "/settings/playback", "/settings/languages", "/settings/downloads",
  "/settings/data", "/settings/password", "/settings/devices", "/settings/media-languages",
  "/settings/profile", "/settings/pair-device",
  "/admin", "/admin/sessions", "/admin/users", "/admin/family", "/admin/downloads",
  "/admin/invites", "/admin/tickets", "/admin/services", "/admin/remote-access", "/admin/system",
  "/admin/metadata", "/admin/plugins", "/admin/about", "/credits",
  "/octave", "/octave/library", "/octave/search", "/octave/liked", "/octave/playlists",
  "/octave/import", "/octave/settings", "/octave/device",
];

const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
let seen = { exceptions: [], console: [], failed: [] };
cdp.on("Runtime.exceptionThrown", (p) =>
  seen.exceptions.push((p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split("\n")[0]));
cdp.on("Runtime.consoleAPICalled", (p) => {
  if (p.type === "error" || p.type === "assert") {
    seen.console.push(p.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
  }
});
const requests = new Map();
cdp.on("Network.requestWillBeSent", (p) => requests.set(p.requestId, p.request.url));
cdp.on("Network.loadingFailed", (p) => {
  if (!p.canceled) seen.failed.push(`${p.errorText} ${requests.get(p.requestId) ?? ""}`.slice(0, 160));
});
cdp.on("Network.responseReceived", (p) => {
  if (p.response.status >= 400) seen.failed.push(`${p.response.status} ${p.response.url}`.slice(0, 160));
});
await cdp.send("Runtime.enable");
await cdp.send("Network.enable");
await cdp.send("Page.enable");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const go = (path) => cdp.eval(`(() => { history.pushState({}, "", ${JSON.stringify(path)});
  dispatchEvent(new PopStateEvent("popstate")); return location.pathname; })()`);

// Les identifiants des écrans paramétrés, lus dans les liens de la page.
async function firstLink(prefix) {
  return cdp.eval(`(() => { const a = [...document.querySelectorAll('a[href]')]
    .map((e) => e.getAttribute('href')).find((h) => h && h.startsWith(${JSON.stringify(prefix)}));
    return a ? a.slice(${prefix.length}).split(/[/?#]/)[0] : null; })()`);
}
const ids = {};
await go("/"); await wait(3000);
ids.media = await firstLink("/media/");
ids.library = await firstLink("/library/");
if (!ids.library) { await go("/libraries"); await wait(2000); ids.library = await firstLink("/library/"); }
if (ids.media) { await go(`/media/${ids.media}`); await wait(2500); ids.person = await firstLink("/person/"); }

const rows = [["route", "chemin final", "titre", "exceptions", "erreurs console", "requêtes en échec", "erreur à l'écran"]];
for (const template of ROUTES) {
  const path = template.replace(/\{(\w+)\}/g, (_, k) => ids[k] ?? `?${k}`);
  if (path.includes("?")) { rows.push([template, "—", "identifiant introuvable", "", "", "", ""]); continue; }
  seen = { exceptions: [], console: [], failed: [] };
  await go(path);
  await wait(Number(process.env.RECETTE_ATTENTE ?? 3000));
  const info = await cdp.eval(`(() => {
    const h = document.querySelector('main h1, main h2, h1, h2');
    const text = document.body.innerText || '';
    const err = /(une erreur|something went wrong|introuvable|n'a pas pu|impossible de)/i.exec(text);
    return { path: location.pathname, title: (h?.innerText || document.title || '').trim().slice(0, 60),
             error: err ? text.slice(Math.max(0, err.index - 40), err.index + 80).replace(/\\s+/g, ' ') : '' };
  })()`);
  const name = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "accueil";
  const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 45 });
  writeFileSync(join(out, `${name}.jpg`), Buffer.from(shot.data, "base64"));
  rows.push([path, info.path, info.title, seen.exceptions.join(" | "), seen.console.join(" | "),
             seen.failed.join(" | "), info.error]);
  console.log(`${path} → ${info.path} — ${info.title}${seen.exceptions.length ? " ⚠ exc" : ""}${seen.failed.length ? " ⚠ réseau" : ""}${info.error ? " ⚠ écran" : ""}`);
}
writeFileSync(join(out, "tableau.tsv"), rows.map((r) => r.join("\t")).join("\n") + "\n");
console.log(`tableau : ${join(out, "tableau.tsv")}`);
cdp.close();
