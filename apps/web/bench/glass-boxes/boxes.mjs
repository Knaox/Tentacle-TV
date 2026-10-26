#!/usr/bin/env node
/**
 * Le Liquid Glass change le MATÉRIAU, jamais les DIMENSIONS (Damien, 26/10 :
 * « pourquoi tout paraît énorme en mode Liquid Glass »). Ce banc le prouve page
 * par page : chaque page, à 1440 × 900, est chargée en verre natif (pont de la
 * coquille SIMULÉ, réglage allumé) puis réglage COUPÉ (même pont, même fenêtre),
 * et les boîtes (`getBoundingClientRect`) de ses éléments principaux — barre,
 * rail, titres, boutons, liens, champs, images, menus ouverts — doivent être
 * identiques à 1 px près.
 *
 *   BANC_ORIGIN=http://127.0.0.1:5712 BANC_USER=… BANC_PASSWORD=… \
 *     node apps/web/bench/glass-boxes/boxes.mjs <sortie.json> /route…
 *
 * Options : THEME=light ; OPEN=<script.js> (ouvre un menu avant la mesure, le
 * corps d'une fonction asynchrone) ; SETTLE=<ms> (attente après chargement).
 * Le client web de dev (Vite) et un backend de banc ; Chrome du système, sans
 * tête, profil jetable. Jamais un compte réel (comptes du Jellyfin du banc).
 * Code de sortie 1 s'il reste un écart.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const { Cdp, waitForTarget } = await import(path.join(ROOT, "apps/desktop-electron/bench/liquid-glass/lib/cdp.mjs"));
const { connectAndLogin } = await import(path.join(ROOT, "apps/desktop-electron/bench/liquid-glass/lib/app.mjs"));

const [OUT, ...ROUTES] = process.argv.slice(2);
if (!OUT || ROUTES.length === 0) throw new Error("usage : boxes.mjs <sortie.json> /route…");
const ORIGIN = process.env.BANC_ORIGIN ?? "http://127.0.0.1:5173";
const USER = process.env.BANC_USER;
const PASSWORD = process.env.BANC_PASSWORD;
if (!USER || !PASSWORD) throw new Error("BANC_USER et BANC_PASSWORD requis (compte du Jellyfin du banc)");
const THEME = process.env.THEME ?? "dark";
const PORT = Number(process.env.BANC_CDP ?? 9382);
const SETTLE = Number(process.env.SETTLE ?? 5000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le pont de la coquille, simulé : macOS 26, verre natif « supporté », le reste muet. */
const BRIDGE = (glass) => `(() => {
  const noop = () => {}; noop.then = (r) => r(() => {});
  const ns = (name) => new Proxy(function () {}, {
    get(_t, p) { if (p === "then") return undefined; if (p === Symbol.toPrimitive) return () => ""; return ns(String(p)); },
    apply() { if (/^(on|subscribe|listen|watch|add)/i.test(name)) return noop; if (/version/i.test(name)) return Promise.resolve("1.40.0"); return Promise.resolve(null); },
  });
  const liquidGlass = { supported: true, refractsVideo: false, setEnabled() {}, upsert() {}, remove() {}, sample: async (rects) => rects.map(() => null) };
  window.tentacle = new Proxy({}, { get(_t, p) {
    if (p === "platform") return "darwin"; if (p === "liquidGlass") return liquidGlass; if (p === "then") return undefined;
    if (p === "version") return "1.40.0"; if (p === "titleBarHeight") return 28; return ns(String(p));
  } });
  try { localStorage.setItem("tentacle_theme_mode", ${JSON.stringify(THEME)}); localStorage.setItem("tentacle_liquid_glass", ${JSON.stringify(String(glass))}); } catch {}
})();`;

/** Les éléments principaux ; clé stable d'un mode à l'autre : balise, rôle, libellé, rang parmi les homonymes. */
const COLLECT = `
  const sel = "[role=menu], [role=dialog], .lg-menu, .lg-menu *, header, nav, aside, main, h1, h2, h3, button, a[href], input, select, textarea, img, [role=button], [role=tab], [role=switch], [role=menuitem], .lgc-sidebar, .lgc-sidebar-item, .lg-content, [data-top-nav] *";
  const seen = new Map(); const out = {};
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest("[aria-hidden=true], .lg-ambient")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight * 3) continue;
    const text = (el.getAttribute("aria-label") || el.getAttribute("alt") || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40);
    const base = el.tagName + "|" + (el.getAttribute("role") || "") + "|" + text;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    out[base + "#" + n] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
  }
  return { mode: document.documentElement.dataset.liquidGlass, boxes: out };`;

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "glass-boxes-"))}`,
  "--window-size=1440,900", "--disable-audio-output", "--no-first-run", "about:blank",
], { stdio: "ignore" });

const report = {};
let failures = 0;
try {
  const target = await waitForTarget(PORT, (u) => u === "about:blank", 30_000);
  const page = await Cdp.connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  // Mouvement réduit : aucune animation d'entrée ne fausse une boîte.
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }, { name: "prefers-reduced-motion", value: "reduce" }] });
  let script = null;
  const escape = async () => {
    for (let i = 0; i < 3; i += 1) {
      if (!(await page.evaluate(`return !!document.querySelector('[role="dialog"], [aria-modal="true"]')`))) return;
      await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await sleep(400);
    }
  };
  async function load(glass, route) {
    if (script) await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script });
    script = (await page.send("Page.addScriptToEvaluateOnNewDocument", { source: BRIDGE(glass) })).identifier;
    await page.send("Page.navigate", { url: `${ORIGIN}${route}` });
    await sleep(SETTLE);
    if (!(await page.evaluate(`return !!localStorage.getItem("tentacle_user")`))) {
      await connectAndLogin(page, { server: ORIGIN, username: USER, password: PASSWORD });
      await sleep(2500);
      await page.send("Page.navigate", { url: `${ORIGIN}${route}` });
      await sleep(SETTLE);
    }
    // « Qui regarde ? » : le profil du compte.
    await page.evaluate(`const b = [...document.querySelectorAll("button")].find((x) => new RegExp(${JSON.stringify(USER)}, "i").test(x.textContent) && x.closest('[role=dialog], .lg-screen')); b?.click(); return 1`);
    await sleep(1500);
    await escape();
    if (process.env.OPEN) {
      await page.evaluate(readFileSync(process.env.OPEN, "utf8"));
      await sleep(900);
    }
    return page.evaluate(COLLECT);
  }
  for (const route of ROUTES) {
    const native = await load(true, route);
    const normal = await load(false, route);
    const diffs = [];
    let compared = 0;
    for (const [key, a] of Object.entries(native.boxes)) {
      const b = normal.boxes[key];
      if (!b) continue;
      compared += 1;
      if (Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 1) diffs.push({ key, native: a, normal: b });
    }
    failures += diffs.length;
    report[route] = { modes: [native.mode, normal.mode], compared, diffs };
    console.log(`${route} : ${native.mode} / ${normal.mode}, ${compared} éléments comparés, ${diffs.length} écart(s) > 1 px`);
    for (const d of diffs.slice(0, 25)) console.log(`    ${d.key}  natif ${JSON.stringify(d.native)}  normal ${JSON.stringify(d.normal)}`);
  }
  writeFileSync(OUT, JSON.stringify(report, null, 1));
} finally {
  chrome.kill("SIGTERM");
}
process.exit(failures === 0 ? 0 : 1);
