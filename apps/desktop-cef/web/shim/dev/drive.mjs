// Conduite du front de Tentacle par CDP, commune aux scénarios du pont. Marche contre
// le faux natif (Chrome sans tête, `run-chrome.mjs`) comme contre CEF (DevTools 9303) :
// tout ce qui touche au natif passe par `window.tentacle`, la seule porte publique.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cdp, pageTarget } from "./cdp.mjs";

const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
// Un appareil PAR port DevTools : une connexion d'API révoque les jetons du même DeviceId
// (Jellyfin), elle ne doit pas chasser le banc d'une autre session.
const DEVICE = `tentacle-cef-banc-${process.env.PONT_CDP_PORT ?? 9303}`;
const AUTH = `MediaBrowser Client="tentacle-cef-banc", Device="banc", DeviceId="${DEVICE}", Version="1.0"`;
const KEYS = { Space: [" ", 32], ArrowRight: ["ArrowRight", 39], KeyF: ["f", 70], KeyN: ["n", 78], Escape: ["Escape", 27] };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un élément Jellyfin du banc par son nom (`type` : Movie, Episode, Series…). */
export async function findItem(name, type = "Movie") {
  const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, {
    method: "POST", headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }),
  })).json();
  const q = new URLSearchParams({ Recursive: "true", IncludeItemTypes: type, SearchTerm: name, Fields: "Path" });
  const res = await (await fetch(`${accounts.jellyfin}/Items?${q}`, { headers: { authorization: `${AUTH}, Token="${login.AccessToken}"` } })).json();
  const items = (res.Items ?? []).sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
  const item = items.find((i) => i.Name === name) ?? items[0];
  if (!item) throw new Error(`introuvable sur le banc : ${name} (${type})`);
  return { item, items };
}

export async function connect() {
  const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
  const results = [];
  const started = Date.now();
  const d = {
    cdp,
    results,
    check(name, ok, detail) {
      results.push({ name, ok: !!ok, detail });
      // Secondes depuis le départ : à croiser avec la chronologie de la sonde EDR.
      const t = ((Date.now() - started) / 1000).toFixed(1).padStart(5);
      console.log(`[${t} s] ${ok ? "✅" : "❌"} ${name} — ${detail}`);
    },
    async key(code) {
      const [k, vk] = KEYS[code];
      for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, code, key: k, windowsVirtualKeyCode: vk });
    },
    wake: () => cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 700 + Math.random() * 20, y: 700 }),
    path: () => cdp.eval("location.pathname"),
    text: () => cdp.eval("document.body.innerText"),
    /** Dernière valeur d'une propriété vue par la sonde. */
    last: (name) => cdp.eval(`window.__probe?.props[${JSON.stringify(name)}]`),
    async waitFor(fn, ms = 8000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(150); }
      return null;
    },
    /** Clique le premier (ou le dernier) bouton dont le texte commence par `text`. */
    clickText: (text, which = "first") => cdp.eval(`(() => {
      const all = [...document.querySelectorAll("button,a,[role=option],[role=menuitem],li")]
        .filter((e) => e.innerText?.trim().startsWith(${JSON.stringify(text)}));
      const el = ${JSON.stringify(which)} === "last" ? all.at(-1) : all[0];
      if (!el) return false; el.click(); return true; })()`),
    /** Les boutons-icônes du lecteur (sans texte ni libellé), dans l'ordre : retour, lecture/pause, son, réglages. */
    clickIcon: (which) => cdp.eval(`(() => {
      const b = [...document.querySelectorAll("button")].filter((b) => !b.getAttribute("aria-label") && !b.innerText.trim() && !b.title);
      const el = ${JSON.stringify(which)} === "last" ? b.at(-1) : b[0];
      if (!el) return false; el.click(); return true; })()`),
    /** Les modales d'accueil (« Nouveautés », « Choisissez votre personnage ») mettent en pause. */
    async dismissModals() {
      for (let i = 0; i < 4; i++) {
        if (!(await d.clickText("Fermer")) && !(await d.clickText("Pas maintenant"))) return;
        await sleep(700);
      }
    },
    /** La sonde : écoute le pont (propriétés, évènements, plein écran). Survit aux remontages du lecteur. */
    probe: () => cdp.eval(`(() => {
      if (window.__probe) return true;
      const p = (window.__probe = { props: {}, events: [], fullscreen: [] });
      window.tentacle.on("mpv://property-change", (c) => { p.props[c.name] = c.data; });
      window.tentacle.on("mpv://event", (e) => p.events.push({ ...e, t: Date.now() }));
      window.tentacle.on("window://fullscreen", (v) => p.fullscreen.push(v));
      return true; })()`),
    /** Ouvre la fiche (`/media/<id>`), interface en français, et clique « Lecture ». */
    async playFromDetail(id) {
      // Libellés cherchés en français : la langue est fixée (CEF suit sinon le système).
      await cdp.eval(`localStorage.setItem("tentacle_language", "fr"); location.assign("/media/${id}")`);
      await sleep(2500);
      await d.dismissModals();
      if (!(await d.clickText("Lecture"))) throw new Error("bouton « Lecture » introuvable sur la fiche");
      await d.waitFor(async () => (await d.path()).startsWith("/watch/"));
      await sleep(500);
      await d.probe();
    },
    finish() {
      cdp.close();
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - failed}/${results.length} cas réussis`);
      process.exit(failed ? 1 : 0);
    },
  };
  return d;
}
