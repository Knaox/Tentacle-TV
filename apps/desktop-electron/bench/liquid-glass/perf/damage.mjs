#!/usr/bin/env node
// Banc de fluidité (lot lg5) : QUELLE zone viz redessine à chaque image ?
// Trace `disabled-by-default-viz.quads` (passes de rendu, zone endommagée)
// pendant l'ouverture d'un menu, avec et sans lentilles.
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { stopTrace } from "./frames.mjs";
import { SCENARIOS } from "./scenarios.mjs";
import { ABLATIONS } from "./ablations.mjs";

const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
const variants = (process.argv[2] ?? "reference,sans-lentille").split(",");
const scenarioName = process.argv[3] ?? "menus";
const out = outDir("lg5-damage");
while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const app = await launchApp({ home: path.join(STATE, "home-lg5-damage"), fresh: true, log: path.join(out, "electron.log") });
try {
  const { page } = app;
  await connectAndLogin(page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(page);
  await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  const scenario = SCENARIOS.find((s) => s.name === scenarioName);
  for (const name of variants) {
    // « a+b » : plusieurs ablations ensemble.
    const parts = name.split("+").map((n) => ABLATIONS.find((a) => a.name === n));
    const ablation = { css: parts.map((a) => a.css).join("\n"), js: parts.map((a) => a.js ?? "").join("\n") };
    await page.evaluate(`document.getElementById("lg5-ablation")?.remove(); const s = document.createElement("style"); s.id = "lg5-ablation"; s.textContent = ${JSON.stringify(ablation.css)}; document.head.append(s); return 1;`);
    if (ablation.js.trim()) await page.evaluate(`${ablation.js} return 1;`);
    await scenario.prep(page);
    await page.send("Tracing.start", { traceConfig: { includedCategories: ["disabled-by-default-viz.quads", "viz", "blink.user_timing"] }, transferMode: "ReturnAsStream" });
    await page.evaluate(`performance.mark("lg5:start"); return 1;`);
    await scenario.run(page).catch(() => {});
    await page.evaluate(`performance.mark("lg5:end"); return 1;`);
    const events = await stopTrace(page);
    writeFileSync(path.join(out, `${name}.trace.json`), JSON.stringify(events));
    console.log(name, events.length, path.join(out, `${name}.trace.json`));
  }
} finally {
  await stopApp(app);
}
