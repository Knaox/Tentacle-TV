#!/usr/bin/env node
// Banc de fluidité (lot lg5) : diagnostic du banc lui-même — le GPU que
// Chromium utilise vraiment (accélération, Metal), les processus d'Electron et
// leurs clients AGX, la fenêtre (taille, position, visibilité), une courte
// trace au repos. Mêmes variables que `run.mjs`.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { eventCensus, frameStats, framesOf, startTrace, stopTrace } from "./frames.mjs";
import { processTree } from "../../../../web/bench/glass-gpu/sampling.mjs";

const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const out = outDir("lg5-diag");
const app = await launchApp({ home: path.join(STATE, "home-lg5-diag"), fresh: true, log: path.join(out, "electron.log"), fullWindow: process.env.BANC_COIN === "0" });
try {
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(app.page);
  const gpu = await evalMain(app, `
    const { app, BrowserWindow } = require("electron");
    const w = BrowserWindow.getAllWindows()[0];
    return { status: app.getGPUFeatureStatus(), info: await app.getGPUInfo("basic"), bounds: w.getBounds(), visible: w.isVisible(),
      occluded: w.webContents.isBackgroundThrottling?.(), frameRate: w.webContents.getFrameRate(),
      metrics: app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, name: m.name, sandboxed: m.sandboxed })) };`);
  console.log(JSON.stringify(gpu.status), JSON.stringify(gpu.bounds), "frameRate", gpu.frameRate, "visible", gpu.visible);
  console.log(JSON.stringify(gpu.info.auxAttributes ?? {}).slice(0, 300));
  console.log(gpu.metrics);
  const tree = processTree(app.pid);
  const ioreg = execFileSync("ioreg", ["-l", "-w0", "-r", "-c", "AGXDeviceUserClient"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const creators = [...ioreg.matchAll(/"IOUserClientCreator" = "pid (\d+), ([^"]+)"/g)].filter((m) => tree.pids.has(Number(m[1])));
  console.log("clients AGX de l'arbre :", creators.map((m) => `${m[1]} ${m[2]}`));
  const page = await app.page.evaluate(`return { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, vis: document.visibilityState, focus: document.hasFocus() };`);
  console.log("page", page);
  await startTrace(app.page);
  await sleep(5000);
  const events = await stopTrace(app.page);
  writeFileSync(path.join(out, "repos.trace.json"), JSON.stringify(events));
  console.log(eventCensus(events, 30));
  console.log(frameStats(framesOf(events), null, 1000 / 30));
} finally {
  await stopApp(app);
}
