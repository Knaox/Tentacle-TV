#!/usr/bin/env node
// Banc de fluidité (lot lg5) : une page AU REPOS ne doit rien produire. Qu'est-ce
// qui bouge quand même ? Mutations du DOM (attributs, styles, nœuds) et
// animations en cours (`document.getAnimations()`), pendant quelques secondes.
//   (mêmes variables que run.mjs) node perf/idle.mjs <route> [secondes] [ablation]
import { readdirSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, go, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, itemId, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { mouseTo } from "../lib/steps.mjs";
import { ABLATIONS } from "./ablations.mjs";

const route = (process.argv[2] ?? "/media/@Banc SDR").replace(/@(.+)$/, "");
const title = /@(.+)$/.exec(process.argv[2] ?? "/media/@Banc SDR")?.[1];
const seconds = Number(process.argv[3] ?? 3);
const ablation = ABLATIONS.find((a) => a.name === (process.argv[4] ?? "reference"));
const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const out = outDir("lg5-repos");
const app = await launchApp({ home: path.join(STATE, "home-lg5-repos"), fresh: true, log: path.join(out, "electron.log") });
try {
  const { page } = app;
  await connectAndLogin(page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(page);
  await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  await page.evaluate(`const s = document.createElement("style"); s.textContent = ${JSON.stringify(ablation.css)}; document.head.append(s); return 1;`);
  await go(page, title ? `${route}${await itemId(title)}` : route, 3500);
  await mouseTo(page, 5, 5);
  await sleep(2000);
  console.log(JSON.stringify(await page.evaluate(`
    const counts = new Map();
    const label = (n) => (n.nodeType === 1 ? n.tagName + "." + String(n.className?.baseVal ?? n.className).split(" ").slice(0, 3).join(".") : "#text").slice(0, 60);
    const mo = new MutationObserver((list) => { for (const m of list) { const k = m.type + " " + (m.attributeName ?? "") + " @ " + label(m.target); counts.set(k, (counts.get(k) ?? 0) + 1); } });
    mo.observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
    let raf = 0;
    await new Promise((r) => setTimeout(r, ${seconds * 1000}));
    mo.disconnect();
    const anims = document.getAnimations().map((a) => (a.animationName ?? a.transitionProperty ?? a.constructor.name) + " " + a.playState + " @ " + label(a.effect?.target ?? document.body));
    return { mutations: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15), animations: anims.slice(0, 15) };`), null, 1));
} finally {
  await stopApp(app);
}
