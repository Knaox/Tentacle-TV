#!/usr/bin/env node
// Banc de fluidité (lot lg5) : le RECENSEMENT des verres d'une page — chaque
// élément qui a un backdrop-filter (givre, lentille), avec ce qui le rend
// invisible tout en coûtant (opacité nulle d'un ancêtre, visibility, hors
// champ, recouvert). Un verre qui ne se voit pas ne doit rien coûter (CLAUDE.md).
//   (mêmes variables que run.mjs) node perf/census.mjs [/route …]
import { readdirSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, go, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { centerOf, clickAt } from "../lib/steps.mjs";

/** « /@plus », « /@compte » : la route, puis le menu de la barre ouvert. */
const MENUS = { plus: ['.lgc-capsule button[aria-haspopup="dialog"]', "Plus"], compte: ['.lgc-capsule button[aria-haspopup="menu"]', null] };

export const CENSUS = `
  const out = [];
  const all = [document.documentElement, ...document.querySelectorAll("*")];
  for (const el of all) {
    for (const pseudo of [null, "::before", "::after"]) {
      const c = getComputedStyle(el, pseudo);
      const bf = c.backdropFilter;
      if (!bf || bf === "none") continue;
      if (pseudo && (c.content === "none" || c.content === "normal")) continue;
      const r = el.getBoundingClientRect();
      let opacity = 1; let hidden = false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = getComputedStyle(n);
        opacity *= Number(s.opacity);
        if (s.visibility === "hidden" || s.display === "none") hidden = true;
      }
      const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      out.push({
        el: ((el.getAttribute("aria-label") || "") + " " + String(el.className?.baseVal ?? el.className)).trim().slice(0, 60) + (pseudo ?? ""),
        size: Math.round(r.width) + "x" + Math.round(r.height),
        lens: /url\\(/.test(bf), opacity: Math.round(opacity * 100) / 100, hidden, onScreen,
      });
    }
  }
  return out;`;

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const out = outDir("lg5-census");
const app = await launchApp({ home: path.join(STATE, "home-lg5-census"), fresh: true, log: path.join(out, "electron.log") });
try {
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(app.page);
  await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  for (const spec of routes) {
    const [route, menu] = spec.split("@");
    await go(app.page, route, 3000);
    if (menu) {
      const at = await centerOf(app.page, ...MENUS[menu]);
      if (at) await clickAt(app.page, at.x, at.y);
      await sleep(1500);
    }
    const list = await app.page.evaluate(CENSUS);
    const costly = list.filter((g) => g.onScreen && !g.hidden && g.opacity > 0.01);
    const waste = list.filter((g) => !costly.includes(g));
    console.log(`\n${spec} : ${list.length} verres, ${costly.length} visibles dont ${costly.filter((g) => g.lens).length} lentilles ; ${waste.length} montés sans se voir`);
    for (const g of list) console.log(`  ${g.lens ? "L" : "·"} ${g.onScreen ? " " : "H"}${g.hidden ? "C" : " "} op ${String(g.opacity).padEnd(4)} ${g.size.padEnd(10)} ${g.el}`);
  }
} finally {
  await stopApp(app);
}
