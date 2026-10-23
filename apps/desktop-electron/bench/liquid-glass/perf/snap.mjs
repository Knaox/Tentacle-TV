#!/usr/bin/env node
// Banc de fluidité (lot lg5) : le rendu NE BOUGE PAS. Mêmes scènes, captures
// de la page (CDP `Page.captureScreenshot`), avant et après un correctif ; puis
// `compare.mjs`-like au pixel. Le travelling du héros est figé (feuille
// injectée) pour qu'une image vaille l'autre. Captures de travail, pas des planches.
//
//   (mêmes variables que run.mjs) node perf/snap.mjs <étiquette> [--theme dark|light]
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, go, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { centerOf, clickAt, mouseTo } from "../lib/steps.mjs";

const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
const label = process.argv[2] ?? "snap";
const theme = process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : "dark";
const out = outDir(`lg5-snap-${label}-${theme}`);
const FREEZE = `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }`;

const SCENES = [
  { name: "accueil", route: "/", open: null },
  { name: "accueil-menu-compte", route: "/", open: ['.lgc-capsule button[aria-haspopup="menu"]', null] },
  { name: "reglages-menu-plus", route: "/settings/appearance", open: ['.lgc-capsule button[aria-haspopup="dialog"]', "Plus"] },
  { name: "favoris", route: "/favorites", open: null },
];

while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const app = await launchApp({ home: path.join(STATE, "home-lg5-snap"), fresh: true, log: path.join(out, "electron.log") });
try {
  const { page } = app;
  await connectAndLogin(page, { server: SERVER, ...account("Knaoxtest") });
  await page.evaluate(`localStorage.setItem("tentacle_theme_mode", ${JSON.stringify(theme)}); return 1;`);
  await evalMain(app, `require("electron").nativeTheme.themeSource = ${JSON.stringify(theme)}; require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  await page.evaluate(`history.replaceState({}, "", "/"); location.reload(); return 1;`).catch(() => {});
  await sleep(7000);
  await page.send("Runtime.enable");
  await dismissOverlays(page);
  for (const scene of SCENES) {
    await go(page, scene.route, 2500);
    await mouseTo(page, 5, 5);
    if (scene.open) {
      const at = await centerOf(page, scene.open[0], scene.open[1]);
      if (at) await clickAt(page, at.x, at.y);
      await sleep(1500);
    }
    // Figé APRÈS l'ouverture : le menu a fini son entrée, le héros ne bouge plus.
    await page.evaluate(`const s = document.createElement("style"); s.id = "lg5-freeze"; s.textContent = ${JSON.stringify(FREEZE)}; document.head.append(s); return 1;`);
    await sleep(1200);
    const shot = await page.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(out, `${scene.name}.png`), Buffer.from(shot.data, "base64"));
    const filters = await page.evaluate(`return [...document.querySelectorAll("filter")].filter((f) => f.querySelector("feDisplacementMap")).map((f) => f.querySelectorAll("feImage").length);`);
    console.log(`${scene.name} : ${filters.length} lentilles, feImage par filtre ${[...new Set(filters)].join("/")}`);
    await page.evaluate(`document.getElementById("lg5-freeze")?.remove(); return 1;`);
    for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(500);
  }
  console.log(out);
} finally {
  await stopApp(app);
}
