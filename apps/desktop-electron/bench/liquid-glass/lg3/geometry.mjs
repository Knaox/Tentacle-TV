// Banc lg3 : la géométrie de l'overlay du lecteur, verre ALLUMÉ puis COUPÉ en
// pleine lecture (le geste de Réglages › Apparence), à plusieurs tailles de
// fenêtre — l'habillage d'avant est la référence. Marges en px CSS, par bord.
//   node lg3/geometry.mjs <compte> [LxH …]      (lecteur déjà ouvert, en pause)
//   node lg3/geometry.mjs <compte> resize       redimensionnement en direct, image par image :
//   la largeur attendue (fenêtre − 2 × 24), celle de la page et celle de la vue native.
//   node lg3/geometry.mjs <compte> fs           en plein écran (120 s d'inactivité), sortie garantie.
import { readFileSync } from "node:fs";
import path from "node:path";
import { sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { mouseTo } from "../lib/steps.mjs";

const [who, ...sizes] = process.argv.slice(2);
readFileSync(path.join(STATE, `hold-${who}.pid`), "utf8");
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { const require = process.mainModule.require; ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;

/** Les marges (gauche, droite, haut, bas) d'un élément dans le viewport ; `null` s'il manque. */
const MEASURE = `
  const insets = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, innerWidth - r.right, r.top, innerHeight - r.bottom].map(Math.round); };
  const glass = !!document.querySelector(".lgp-dock");
  if (glass) return { glass, vp: [innerWidth, innerHeight],
    retour: insets(document.querySelector(".lgp-pastille")),
    temps: insets(document.querySelector(".lgp-timecap")),
    gauche: insets(document.querySelector(".lgp-groups > :first-child")),
    centre: insets(document.querySelector(".lgp-groups > :nth-child(2)")),
    droite: insets(document.querySelector(".lgp-groups > :last-child")) };
  const bars = [...document.querySelectorAll(".pointer-events-auto > div")];
  const top = bars.find((b) => b.className.includes("bg-gradient-to-b"));
  const bottom = bars.find((b) => b.className.includes("bg-gradient-to-t"));
  const row = bottom?.querySelector(":scope > .flex.items-center.justify-between");
  return { glass, vp: [innerWidth, innerHeight],
    retour: insets(top?.querySelector("button")),
    temps: insets(bottom?.querySelector(".group\\\\/bar")),
    gauche: insets(row?.firstElementChild?.firstElementChild),
    droite: insets(row?.lastElementChild?.lastElementChild) };
`;

async function wake() {
  const s = await page.evaluate("return { w: innerWidth, h: innerHeight };");
  await mouseTo(page, s.w / 2, s.h / 2);
  await sleep(120);
  await mouseTo(page, s.w / 2 + 30, s.h / 2 + 15);
  await sleep(900);
}

const setGlass = (on) => page.evaluate(`window.__tentaclePlayerGlass.setLiquidGlass(${on}); return 1;`);

/** Un redimensionnement joué par le principal : 40 pas de 16 ms, relevés à chaque pas. */
const RESIZE = `
  const { BrowserWindow, screen } = require("electron");
  const win = BrowserWindow.getAllWindows()[0];
  const a = screen.getAllDisplays().sort((u, v) => v.size.width - u.size.width)[0].workArea;
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i <= 40; i += 1) {
    const w = Math.round(900 + (780 * i) / 40);
    win.setBounds({ x: a.x + 40, y: a.y + 30, width: w, height: 760 });
    await wait(16);
    const pageW = await win.webContents.executeJavaScript("(() => { const r = document.querySelector('.lgp-timecap')?.getBoundingClientRect(); return r ? Math.round(r.width) : null; })()");
    const region = globalThis.__tentacleGlass.snapshot().regions.find((r) => !r.hidden && Math.abs(r.css.height - 36) < 1);
    out.push([win.getContentBounds().width - 48, pageW, region ? Math.round(region.frame.width) : null]);
  }
  await wait(400);
  const pageW = await win.webContents.executeJavaScript("Math.round(document.querySelector('.lgp-timecap')?.getBoundingClientRect().width ?? -1)");
  const region = globalThis.__tentacleGlass.snapshot().regions.find((r) => !r.hidden && Math.abs(r.css.height - 36) < 1);
  out.push(["repos", win.getContentBounds().width - 48, pageW, region ? Math.round(region.frame.width) : null]);
  return out;
`;

try {
  if (sizes[0] === "resize") {
    await wake();
    const rows = await evalMain(RESIZE);
    const lagging = rows.filter((r) => typeof r[0] === "number" && (r[1] !== r[0] || r[2] !== r[1]));
    console.log(JSON.stringify({ pas: rows.length - 1, ecarts: lagging.length, detail: rows }));
    sizes.length = 0;
    sizes.push("1280x760");
  }
  const isFull = () => evalMain(`return require("electron").BrowserWindow.getAllWindows()[0].isFullScreen();`);
  if (sizes[0] === "fs") {
    await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`);
    for (let i = 0; i < 20 && !(await isFull()); i += 1) await sleep(250);
    await sleep(1500);
  }
  for (const size of sizes.length ? sizes : ["900x560", "1280x760", "1680x1000"]) {
    const [w, h] = size === "fs" ? [0, 0] : size.split("x").map(Number);
    await evalMain(`const { BrowserWindow, screen } = require("electron"); const win = BrowserWindow.getAllWindows()[0];
      if (${w} > 0 && !win.isFullScreen()) { const a = screen.getAllDisplays().sort((u, v) => v.size.width - u.size.width)[0].workArea;
      win.setBounds({ x: a.x + Math.round((a.width - ${w}) / 2), y: a.y + 30, width: ${w}, height: ${h} }); } return 1;`);
    await sleep(800);
    await wake();
    const verre = await page.evaluate(MEASURE);
    await setGlass(false);
    await sleep(900);
    await wake();
    const avant = await page.evaluate(MEASURE);
    await setGlass(true);
    await sleep(900);
    console.log(JSON.stringify({ taille: size, verre, avant }));
  }
} finally {
  await setGlass(true).catch(() => {});
  // Jamais Damien laissé sur un espace plein écran du banc.
  if (await evalMain(`return require("electron").BrowserWindow.getAllWindows()[0].isFullScreen();`).catch(() => false)) {
    await page.evaluate(`await window.tentacle.invoke("toggle_fullscreen"); return true;`).catch(() => {});
    await sleep(2500);
    console.log("plein écran quitté");
  }
  page.close();
  main.close();
}
