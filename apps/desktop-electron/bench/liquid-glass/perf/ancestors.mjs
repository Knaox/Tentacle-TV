#!/usr/bin/env node
// Banc de fluidité (lot lg5) : les ANCÊTRES d'un verre qui en font une racine
// d'arrière-plan ou une surface de rendu (opacité, transform, will-change,
// filtre, isolation, mélange, masque, contain) — ce qui décide de ce qu'une
// lentille doit relire et recalculer à chaque image.
//   (mêmes variables que run.mjs) node perf/ancestors.mjs "<sélecteur>" [route]
import { readdirSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, go, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";

const selector = process.argv[2] ?? ".lg-surface.h-9.w-9";
const route = process.argv[3] ?? "/";
const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const out = outDir("lg5-ancetres");
const app = await launchApp({ home: path.join(STATE, "home-lg5-ancetres"), fresh: true, log: path.join(out, "electron.log") });
try {
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(app.page);
  await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  await go(app.page, route, 3000);
  console.log(JSON.stringify(await app.page.evaluate(`
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return "introuvable";
    const rows = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      const flags = [
        c.opacity !== "1" && "opacity " + c.opacity,
        c.transform !== "none" && "transform",
        c.scale !== "none" && "scale " + c.scale,
        c.translate !== "none" && "translate",
        c.willChange !== "auto" && "will-change " + c.willChange,
        c.filter !== "none" && "filter " + c.filter.slice(0, 40),
        c.backdropFilter !== "none" && "backdrop " + c.backdropFilter.slice(0, 40),
        c.isolation !== "auto" && "isolation",
        c.mixBlendMode !== "normal" && "blend " + c.mixBlendMode,
        c.maskImage !== "none" && "mask",
        c.clipPath !== "none" && "clip-path",
        c.contain !== "none" && "contain " + c.contain,
        c.overflow !== "visible" && "overflow " + c.overflow,
        c.animationName !== "none" && "animation " + c.animationName,
        c.position === "fixed" && "fixed",
      ].filter(Boolean);
      rows.push((n.tagName + "." + String(n.className?.baseVal ?? n.className).split(" ").slice(0, 4).join(".")).slice(0, 70) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " | " + flags.join(" · "));
    }
    return rows;`), null, 1));
} finally {
  await stopApp(app);
}
