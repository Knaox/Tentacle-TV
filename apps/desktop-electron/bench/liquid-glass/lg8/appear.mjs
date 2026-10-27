// Banc lg8 (apparition) : la matérialisation des contrôles, IMAGE PAR IMAGE.
// L'app est tenue par `lg2/hold.mjs`, un clip en lecture, la fenêtre ACTIVE de préférence
// (`lg3/probe.mjs … show` puis `activate`). Un cycle : contrôles masqués → mouvement de souris
// (entrée) → attente du masquage automatique (sortie).
//
// Relevé à chaque image de la page (rAF) : pour chaque forme matérialisée, l'opacité et le
// rectangle AFFICHÉ de son contenu (transformé), l'opacité de son `::before`. Dans le principal,
// toutes les 4 ms, la couche de PRÉSENTATION de chaque verre natif (`live` : cadre en vol,
// opacité de son conteneur) et le nombre de vues natives. Horloge commune : `Date.now()`.
//
//   node lg8/appear.mjs <nom> [controls|popover] [normal|reduce]   → <sortie>/appear-<nom>.json + un résumé
// `popover` : ouvre puis ferme le panneau des pistes au lieu du cycle des contrôles.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { PORTS } from "../lib/electron.mjs";
import { mouseTo } from "../lib/steps.mjs";
import { analyse } from "./appearAnalysis.mjs";

const [name = "cycle", mode = "controls", motion = "normal"] = process.argv.slice(2);
const OUT = process.env.LG8_OUT ?? path.join(process.env.HOME, "Pictures/tentacle-banc-liquid-glass/2026-10-27-lg8-apparition");
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
// `reduce` : « Réduire les animations » émulé — tenu par CETTE connexion, qui reste ouverte tout le relevé.
if (motion === "reduce") {
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await sleep(300);
}
const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;

const DURATION = mode === "popover" ? 2600 : 7500;
const RECORD_PAGE = `
  window.__lg8 = [];
  const end = Date.now() + ${DURATION};
  const num = (v) => Number.parseFloat(v);
  const tick = () => {
    const shapes = [];
    for (const el of document.querySelectorAll(".lgp-surface[data-lgp-materialize]")) {
      const child = el.firstElementChild;
      const rest = el.getBoundingClientRect();
      const seen = child ? child.getBoundingClientRect() : rest;
      shapes.push({
        cls: el.className.replace(/lgp-surface\\s*/, "").split(" ")[0],
        present: el.dataset.lgpPresent,
        rest: [rest.x, rest.y, rest.width, rest.height],
        seen: [seen.x, seen.y, seen.width, seen.height],
        opacity: child ? num(getComputedStyle(child).opacity) : 1,
        dim: num(getComputedStyle(el, "::before").opacity),
      });
    }
    window.__lg8.push([Date.now(), shapes]);
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return devicePixelRatio;`;
const RECORD_MAIN = `
  const out = []; const end = Date.now() + ${DURATION};
  const zoom = require("electron").BrowserWindow.getAllWindows()[0].webContents.getZoomFactor();
  while (Date.now() < end) {
    const s = globalThis.__tentacleGlass.snapshot();
    out.push([Date.now(), s.nativeViews, s.regions.filter((r) => r.live).map((r) => ({ css: r.css, frame: r.frame, live: r.live })), (s.leaving ?? []).filter(Boolean)]);
    await new Promise((r) => setTimeout(r, 4));
  }
  return { zoom, out };`;
const require_ = `const require = process.mainModule.require;`;

try {
  const size = await page.evaluate(`return { w: innerWidth, h: innerHeight };`);
  // Point de départ : contrôles masqués et 0 vue native (le masquage automatique).
  if (mode === "controls") {
    await mouseTo(page, size.w - 2, 2);
    for (let i = 0; i < 40; i += 1) {
      const views = await evalMain(`return globalThis.__tentacleGlass.snapshot().nativeViews;`);
      if (views === 0) break;
      await sleep(250);
    }
  }
  await page.evaluate(RECORD_PAGE);
  const nativeRun = evalMain(`${require_} ${RECORD_MAIN}`);
  await sleep(300);
  const t0 = Date.now();
  if (mode === "controls") {
    await mouseTo(page, size.w / 2, size.h / 2);
    await sleep(60);
    await mouseTo(page, size.w / 2 + 40, size.h / 2 + 20);
  } else {
    await page.evaluate(`document.querySelector('[data-lgp-anchor="player-tracks"]').click(); return 1;`);
    await sleep(1100);
    await page.evaluate(`document.querySelector('[data-lgp-anchor="player-tracks"]').click(); return 1;`);
  }
  await sleep(DURATION);
  const pageRows = await page.evaluate("return window.__lg8;");
  const native = await nativeRun;
  const report = analyse(pageRows, native.out, native.zoom, t0);
  console.log(JSON.stringify({ name, mode, ...report }, null, 1));
  writeFileSync(path.join(OUT, `appear-${name}.json`), JSON.stringify({ name, mode, t0, report, pageRows, native }));
} finally {
  page.close();
  main.close();
}
