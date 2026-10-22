// Banc lg3 (verre du lecteur) : sonde l'app tenue par `lg2/hold.mjs`, par CDP.
//   node lg3/probe.mjs <compte> <commande> [args…]
//   play <titre> · snap · shot <nom> · show · corner · fs on|off · controls · idle
// `show` pose la fenêtre À L'ÉCRAN sans l'activer (la vidéo hors écran n'est pas
// peinte, rien à mesurer au coin) ; `corner` l'y renvoie. `show` et `fs` exigent
// 120 s d'inactivité de Damien — `fs off` jamais : on ressort toujours. `show` vise le
// plus grand écran (LG3_DISPLAY=primary : l'écran principal) — l'autre peut montrer
// un espace plein écran de Damien, où notre fenêtre ne serait pas à l'écran.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { go, mpvProperty, sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE, itemId } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { captureWindow, hidIdleSeconds, mainWindow } from "../lib/macos.mjs";
import { mouseTo } from "../lib/steps.mjs";

const [who, cmd, ...args] = process.argv.slice(2);
const [, electronPid] = readFileSync(path.join(STATE, `hold-${who}.pid`), "utf8").trim().split(" ").map(Number);
const OUT = process.env.LG3_OUT ?? path.join(process.env.HOME, "Pictures/tentacle-banc-liquid-glass/lg3");
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
const main = await (async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
  return Cdp.connect(list[0].webSocketDebuggerUrl);
})();
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { const require = process.mainModule.require; ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;
const WIN = `const { BrowserWindow, screen } = require("electron"); const w = BrowserWindow.getAllWindows().find((x) => x.getTitle() !== "" || true);`;

/** Le pid de l'application au premier plan : jamais la nôtre (le clavier de Damien). */
function frontPid() {
  const asn = execFileSync("lsappinfo", ["front"], { encoding: "utf8" }).trim();
  return Number(/"pid"=(\d+)/.exec(execFileSync("lsappinfo", ["info", "-only", "pid", asn], { encoding: "utf8" }))?.[1]);
}

/** Le plein écran active l'app : on rend le premier plan (app.hide → macOS réactive la précédente). */
async function giveBackFront(previous = null) {
  if (frontPid() !== electronPid) return console.log("premier plan rendu :", frontPid());
  const bundle = previous === null ? null : /"CFBundleIdentifier"="([^"]+)"/.exec(execFileSync("lsappinfo", ["info", "-only", "bundleid", String(previous)], { encoding: "utf8" }))?.[1];
  if (bundle) {
    execFileSync("osascript", ["-e", `tell application id "${bundle}" to activate`]);
    await sleep(600);
    if (frontPid() !== electronPid) return console.log("premier plan rendu à", bundle);
  }
  await evalMain(`require("electron").app.hide(); return 1;`);
  await sleep(600);
  console.log("premier plan après hide :", frontPid() === electronPid ? "LE BANC (!)" : frontPid());
}

/** Capture de notre fenêtre ; en pleine transition d'espace elle peut échouer : on le dit, on continue. */
function safeShot(name) {
  try {
    const win = mainWindow(STATE, electronPid);
    if (win) captureWindow(win.id, path.join(OUT, `${name}.png`));
  } catch (error) {
    console.log(`capture ${name} impossible : ${String(error.message ?? error).slice(0, 60)}`);
  }
}

function needIdle() {
  const idle = hidIdleSeconds();
  if (idle < 120) {
    console.log(`Damien actif (${idle} s) : refusé`);
    return false;
  }
  return true;
}

/** Ce que la page pose (surfaces, tons) et ce qu'AppKit montre (vues, cadres). */
const SNAP_PAGE = `
  const out = [];
  for (const el of document.querySelectorAll(".lgp-surface")) {
    const r = el.getBoundingClientRect();
    out.push({ cls: el.className.replace(/lgp-surface\\s*/, "").slice(0, 40), present: el.dataset.lgpPresent, tone: el.dataset.lgTone ?? null,
      css: [r.x, r.y, r.width, r.height].map((v) => Math.round(v)) });
  }
  return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, surfaces: out };
`;

/** Un relevé court : fenêtre, page, et chaque région (css en px, cadre AppKit en pt, origine en bas). */
async function brief(label) {
  const pg = await page.evaluate(SNAP_PAGE);
  const nat = await evalMain(`${WIN} const s = globalThis.__tentacleGlass?.snapshot?.(); return { full: w.isFullScreen(), content: w.getContentBounds(), views: s?.nativeViews, regions: (s?.regions ?? []).map((r) => [r.hidden ? "H" : "V", Math.round(r.css.x), Math.round(r.css.y), Math.round(r.css.width), Math.round(r.css.height), "|", Math.round(r.frame.x), Math.round(r.frame.y), Math.round(r.frame.width), Math.round(r.frame.height)].join(" ")) };`);
  const shown = pg.surfaces.filter((x) => x.present === "true").map((x) => `${x.cls.split(" ")[0]} ${x.css.join(",")}`);
  const band = await page.evaluate(`return document.documentElement.dataset.hoteBandeau ?? "non";`);
  console.log(JSON.stringify({ label, band, viewport: pg.viewport, full: nat.full, views: nat.views, regions: nat.regions.slice(0, 3), page: shown.slice(0, 3) }));
}

try {
  switch (cmd) {
    case "fsseq": {
      if (!needIdle()) break;
      const before = frontPid();
      const s = await page.evaluate("return { w: innerWidth, h: innerHeight };");
      const wake = async () => { await mouseTo(page, s.w / 2, s.h / 2); await sleep(120); await mouseTo(page, s.w / 2 + 30, s.h / 2 + 15); };
      const toggle = () => page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
      if (args[0] !== "hidden") await wake();
      await sleep(900);
      await brief("avant");
      const t0 = Date.now();
      await toggle();
      for (const at of [150, 500, 1000, 1600, 2600]) {
        await sleep(Math.max(0, at - (Date.now() - t0)));
        await brief(`entrée+${at}`);
        if (at === 500) safeShot(`fs-in500-${args[0] ?? "ctl"}`);
      }
      await wake(); await sleep(1200); await brief("plein écran, contrôles");
      safeShot(`fs-on-${args[0] ?? "ctl"}`);
      const t1 = Date.now();
      await toggle();
      for (const at of [150, 500, 1000, 1600, 2600]) {
        await sleep(Math.max(0, at - (Date.now() - t1)));
        await brief(`sortie+${at}`);
        if (at === 500) safeShot(`fs-out500-${args[0] ?? "ctl"}`);
      }
      await wake(); await sleep(1200); await brief("fenêtré, contrôles");
      safeShot(`fs-off-${args[0] ?? "ctl"}`);
      await giveBackFront(before);
      break;
    }
    case "play": {
      const before = frontPid();
      await go(page, `/watch/${await itemId(args.join(" "), "Movie")}`, 2000);
      const end = Date.now() + 40_000;
      while (!(Number(await mpvProperty(page, "time-pos")) > 1.5) && Date.now() < end) await sleep(500);
      console.log("time-pos", await mpvProperty(page, "time-pos"));
      // Le lancement de mpv ACTIVE l'app (mesuré, 22/10) : on rend aussitôt le premier plan.
      await giveBackFront(before);
      break;
    }
    case "controls": {
      const s = await page.evaluate("return { w: innerWidth, h: innerHeight };");
      await mouseTo(page, s.w / 2, s.h / 2);
      await sleep(150);
      await mouseTo(page, s.w / 2 + 40, s.h / 2 + 20);
      await sleep(Number(args[0] ?? 1500));
      break;
    }
    case "snap": {
      const pg = await page.evaluate(SNAP_PAGE);
      const nat = await evalMain(`${WIN} const s = globalThis.__tentacleGlass?.snapshot?.(); return { full: w.isFullScreen(), bounds: w.getBounds(), content: w.getContentBounds(), zoom: w.webContents.getZoomFactor(), views: s?.nativeViews, surfaceVisible: s?.surfaceVisible, regions: (s?.regions ?? []).map((r) => ({ id: r.id, level: r.level, hidden: r.hidden, css: r.css, frame: r.frame })) };`);
      console.log(JSON.stringify({ page: pg, native: nat }, null, 1));
      break;
    }
    case "shot": {
      const win = mainWindow(STATE, electronPid);
      console.log(captureWindow(win.id, path.join(OUT, `${args[0]}.png`)));
      break;
    }
    case "show": {
      if (!needIdle()) break;
      // D'abord rendre l'app visible (cachée par `app.hide`) : son évènement `show` renvoie la
      // fenêtre au coin (`placeInCorner`) — le placement vient APRÈS.
      await evalMain(`require("electron").app.show(); return 1;`);
      await sleep(400);
      console.log(await evalMain(`${WIN} const d = ${JSON.stringify(process.env.LG3_DISPLAY ?? "")} === "primary" ? screen.getPrimaryDisplay() : screen.getAllDisplays().sort((u, v) => v.size.width - u.size.width)[0]; const a = d.workArea; w.setBounds({ x: a.x + Math.round((a.width - 1280) / 2), y: a.y + 40, width: 1280, height: 760 }); if (!w.isVisible()) w.showInactive(); return w.getBounds();`));
      break;
    }
    case "corner":
      console.log(await evalMain(`${WIN} if (w.isFullScreen()) return "plein écran : fs off d'abord"; const a = screen.getPrimaryDisplay().workArea; w.setPosition(a.x + a.width - 60, a.y + a.height - 60); return w.getBounds();`));
      break;
    case "fs": {
      if (args[0] === "on" && !needIdle()) break;
      const want = args[0] === "on";
      const was = await evalMain(`${WIN} return w.isFullScreen();`);
      if (was !== want) await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
      console.log(`avant ${was}, voulu ${want}`);
      break;
    }
    case "unfront": await giveBackFront(args[0] ? Number(args[0]) : null); break;
    // La fenêtre ACTIVE (le rendu que voit l'utilisateur : le verre y est plus clair). 120 s d'inactivité.
    case "activate": {
      if (!needIdle()) break;
      console.log("avant", frontPid());
      await evalMain(`${WIN} require("electron").app.focus({ steal: true }); w.focus(); return 1;`);
      await sleep(700);
      break;
    }
    case "pause": console.log(await page.evaluate(`try { await window.tentacle.invoke("mpv_set_property", { name: "pause", value: ${args[0] !== "off"} }); return "ok"; } catch (e) { return String(e); }`)); break;
    case "idle": console.log(hidIdleSeconds(), "premier plan", frontPid() === electronPid ? "LE BANC (!)" : frontPid()); break;
    default: console.log("commande inconnue");
  }
} finally {
  // Jamais Damien laissé sur un espace plein écran du banc, même si une étape a levé.
  if (cmd === "fsseq") {
    const still = await evalMain(`${WIN} return w.isFullScreen();`).catch(() => false);
    if (still) {
      await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`).catch(() => {});
      await sleep(2500);
      console.log("plein écran quitté par la garde");
    }
  }
  page.close();
  main.close();
}
