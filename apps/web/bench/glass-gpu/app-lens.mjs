#!/usr/bin/env node
/**
 * La lentille sur l'APPLICATION réelle — bureau de ce worktree (build de
 * production), mode natif de macOS 26, connecté au Jellyfin JETABLE du banc
 * de lg-banc (compte Knaoxtest jetable, jamais un compte réel).
 *
 *   BANC_STATE=<état de lg-banc> node apps/web/bench/glass-gpu/app-lens.mjs \
 *     --home <profil jetable> [--seconds 6] [--out rapport.json]
 *
 * 1. Contrôle : sur le premier bouton `[data-lg-lens]` visible de l'accueil,
 *    l'échelle au repos, au survol, à l'appui et après le relâcher.
 * 2. Coût : repos, pointeur posé, appuis répétés — chaque fois lentille
 *    RETIRÉE (référence) puis posée, temps GPU par processus (`sampling.mjs`).
 * Les clics sont interceptés sur la page : un appui ne lance jamais rien.
 * Services (backend :3107, Jellyfin :18307) : ceux du banc de lg-banc.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { connectAndLogin, dismissOverlays, sleep } from "../../../desktop-electron/bench/liquid-glass/lib/app.mjs";
import { SERVER, account } from "../../../desktop-electron/bench/liquid-glass/lib/config.mjs";
import { launchApp, stopApp } from "../../../desktop-electron/bench/liquid-glass/lib/electron.mjs";
import { judgeScenario } from "../../src/theme/glass/gpuBudget.ts";
import { sample, summarizePass } from "./sampling.mjs";

const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const seconds = Number(args.get("--seconds") ?? 6);
const home = args.get("--home");
if (!home) throw new Error("--home <profil jetable> requis");

/**
 * Inventaire des porteurs de lentille (avec le rendu de leur verre : une
 * lentille sur un verre NATIF enfreint le carnet § 6), puis la cible : le plus
 * grand bouton de PAGE (hors barre de fenêtre, hors verre natif). Ses clics
 * sont bloqués : un appui ne lance jamais rien.
 */
const PICK_TARGET = `
  const all = [...document.querySelectorAll("[data-lg-lens]")].map((el) => {
    const r = el.getBoundingClientRect();
    const glass = el.closest("[data-lg-render]");
    return { el, r, render: glass ? glass.getAttribute("data-lg-render") : "page",
      label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
      chrome: !!el.closest("header, nav, [data-lg-chrome]") };
  });
  const inventory = all.map(({ r, render, label, chrome }) => ({ label, render, chrome, w: Math.round(r.width), h: Math.round(r.height) }));
  const pick = all
    .filter(({ r, render, chrome }) => r.width > 40 && r.height > 24 && r.top > 0 && r.bottom < innerHeight && render !== "native" && !chrome)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
  if (!pick) return { inventory, target: null };
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click"]) {
    window.addEventListener(type, (e) => { if (e.target instanceof Element && e.target.closest("[data-bench-lens]")) e.stopPropagation(); }, true);
  }
  pick.el.setAttribute("data-bench-lens", "");
  const r = pick.r;
  return { inventory, target: { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, label: pick.label, render: pick.render } };`;

/** L'élément sous le point visé, relu à chaque fois : un nouveau rendu peut le remplacer. */
const at = (t) => `document.elementFromPoint(${t.x}, ${t.y})?.closest("[data-bench-lens], [data-lg-lens], button, a")`;
const SCALE = (t) => `const el = ${at(t)}; return el ? getComputedStyle(el).scale : "absent";`;
const setLens = (t, on) =>
  `const el = ${at(t)}; if (!el) return false; el.setAttribute("data-bench-lens", ""); ${on ? 'el.setAttribute("data-lg-lens", "")' : 'el.removeAttribute("data-lg-lens")'}; return true;`;

async function main() {
  const app = await launchApp({ home, fresh: true, log: path.join(home, "electron.log") });
  const report = { date: new Date().toISOString(), seconds };
  try {
    const page = app.page;
    const mouse = (type, x, y, extra = {}) => page.send("Input.dispatchMouseEvent", { type, x, y, button: "none", ...extra });
    await connectAndLogin(page, { server: SERVER, ...account("Knaoxtest") });
    await sleep(4000);
    await dismissOverlays(page);
    await sleep(1500);
    report.mode = await page.evaluate(`return document.documentElement.dataset.liquidGlass ?? null;`);
    const picked = await page.evaluate(PICK_TARGET);
    const target = picked.target;
    report.inventory = picked.inventory;
    report.target = target;
    const onNative = picked.inventory.filter((i) => i.render === "native");
    console.log(`porteurs de lentille : ${picked.inventory.length}, dont sur verre natif : ${onNative.length}${onNative.length ? " — " + onNative.map((i) => i.label).join(", ") : ""}`);
    if (report.mode !== "native" || !target) throw new Error(`mode ${report.mode}, cible ${JSON.stringify(target)}`);

    // 1. La lentille, état par état.
    const left = { button: "left", clickCount: 1 };
    await mouse("mouseMoved", 4, 4);
    await sleep(800);
    const rest = await page.evaluate(SCALE(target));
    await mouse("mouseMoved", target.x, target.y);
    await sleep(800);
    const hover = await page.evaluate(SCALE(target));
    await mouse("mousePressed", target.x, target.y, left);
    await sleep(800);
    const press = await page.evaluate(SCALE(target));
    await mouse("mouseReleased", target.x, target.y, left);
    await sleep(800);
    const released = await page.evaluate(SCALE(target));
    report.lens = { rest, hover, press, released };
    console.log(`lentille sur « ${target.label} » : repos ${rest} · survol ${hover} · appui ${press} · relâché ${released}`);

    // 2. Le coût, lentille retirée puis posée.
    const scenarios = {
      idle: { at: [4, 4], drive: null },
      hoverStill: { at: [target.x, target.y], drive: null },
      pressPulse: { at: [target.x, target.y], drive: (i) => mouse(i % 2 === 0 ? "mousePressed" : "mouseReleased", target.x, target.y, left) },
    };
    report.results = [];
    for (const [scenario, { at, drive }] of Object.entries(scenarios)) {
      const passes = {};
      for (const on of [false, true]) {
        await page.evaluate(setLens(target, on));
        await mouse("mouseMoved", 4, 4);
        await sleep(400);
        await mouse("mouseMoved", at[0], at[1]);
        await sleep(1500);
        let running = drive !== null;
        const loop = (async () => {
          for (let i = 0; running; i += 1) {
            await drive(i);
            await sleep(200);
          }
        })();
        const raw = await sample(seconds * 1000, app.pid);
        running = false;
        await loop;
        await mouse("mouseReleased", at[0], at[1], left);
        passes[on ? "on" : "off"] = summarizePass(raw);
      }
      const verdict = judgeScenario(scenario, passes.on.gpu, passes.off.gpu);
      report.results.push({ ...verdict, reference: passes.off, measured: passes.on });
      console.log(
        `${verdict.ok ? "✓" : "✗"} ${scenario.padEnd(11)} GPU Electron ${passes.off.gpu.median} → ${passes.on.gpu.median} %` +
          `${verdict.gestureMs === undefined ? "" : ` = ${verdict.gestureMs} ms/appui`} (budget ${verdict.limit} ${verdict.unit})` +
          ` · WindowServer ${passes.off.windowServer.median} → ${passes.on.windowServer.median} %`,
      );
    }
  } finally {
    await stopApp(app);
    if (args.get("--out")) writeFileSync(args.get("--out"), `${JSON.stringify(report, null, 2)}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
