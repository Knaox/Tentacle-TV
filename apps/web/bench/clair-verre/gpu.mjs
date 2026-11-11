#!/usr/bin/env node
/**
 * Banc « clair-verre » : ce que COÛTE le verre, image par image, dans la vraie coquille CEF — sans `sudo`.
 *
 *   CEF_PID=<pid> BANC_ORIGIN=<adresse servie à la coquille> node bench/clair-verre/gpu.mjs [étiquette]   (depuis apps/web)
 *
 * La coquille est déjà lancée sur un build de PRODUCTION du front (`vite build` puis `vite preview` : le
 * client de dev tient un compteur d'images qui fabrique les images qu'on compte), en sourdine, sans le focus.
 * Deux gestes, ceux où une image change SOUS un verre :
 *   - `accueil`      : la bannière qui bouge sous la barre du haut, 8 s au repos ;
 *   - `bibliotheque` : la page défilée sous la barre et le panneau d'outils, 4 s vers le bas puis 4 s vers le haut.
 * Mesures : la trace de Chromium (`PipelineReporter`, `lib/trace/`, repris du banc de fluidité de l'ancien bureau Electron) —
 * images attendues, présentées, ABANDONNÉES, et le temps de DESSIN du processus GPU par image
 * (`StartDrawToSwapStart` : flous, courbes, compositing) ; à côté, l'occupation GPU des processus de l'app
 * (`ioreg`, clients AGX — `bench/glass-gpu/sampling.mjs`).
 *
 * THEME=light|dark ; SANS_COURBE=1 retire la courbe de tons du givre (`--lg-frost-curve`) par une feuille
 * injectée — un instrument pour isoler son coût dans le MÊME build, jamais une proposition de rendu ;
 * ROUNDS (défaut 3). Mac au calme : une mesure sous charge ne vaut rien.
 */
import { framesOf, frameStats, markWindow, startTrace, stopTrace } from "./lib/trace/frames.mjs";
import { stageStats } from "./lib/trace/stages.mjs";
import { sample, summarizePass } from "../glass-gpu/sampling.mjs";
import { connectCef } from "./lib/cef.mjs";
import { visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const label = process.argv[2] ?? "mesure";
const theme = process.env.THEME === "light" ? "light" : "dark";
const rounds = Number(process.env.ROUNDS ?? 3);
const pid = Number(process.env.CEF_PID);
if (!pid) throw new Error("usage : CEF_PID=<pid> BANC_ORIGIN=<adresse> gpu.mjs [étiquette]");

const { browser, page } = await connectCef({ theme, glass: true, origin: process.env.BANC_ORIGIN });
const trace = await browser.newBrowserCDPSession();
const library = (await buildScenes(page)).find((s) => s.name === "bibliotheque-1").route;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const mark = (name) => page.evaluate((n) => performance.mark(n), name);

async function prepare(route) {
  await visit(page, route, 3500);
  if (process.env.SANS_COURBE === "1") await page.addStyleTag({ content: "* { --lg-frost-curve: brightness(1) !important; }" });
  await page.mouse.move(720, 620);
  await sleep(800);
}

const GESTURES = {
  accueil: { route: "/", run: () => sleep(8000) },
  bibliotheque: {
    route: library,
    run: async () => {
      for (const direction of [1, -1]) {
        const until = Date.now() + 4000;
        while (Date.now() < until) {
          await page.mouse.wheel(0, 160 * direction);
          await sleep(110);
        }
      }
    },
  },
};

const median = (list) => { const s = [...list].filter((v) => v !== null && v !== undefined).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const report = { label, theme, courbe: process.env.SANS_COURBE === "1" ? "retirée" : "du build", gestes: {} };
for (const [name, gesture] of Object.entries(GESTURES)) {
  const passes = [];
  for (let round = 0; round < rounds; round++) {
    await prepare(gesture.route);
    await startTrace(trace);
    await mark("lg5:start");
    const [gpu] = await Promise.all([sample(8000, pid), gesture.run()]);
    await mark("lg5:end");
    const events = await stopTrace(trace);
    const window = markWindow(events);
    const frames = frameStats(framesOf(events), window);
    const draw = stageStats(events, window).StartDrawToSwapStart;
    passes.push({ expected: frames.expected, presented: frames.frames, dropped: frames.dropped, fps: frames.fps, drawP50: draw.p50, drawP95: draw.p95, gpu: summarizePass(gpu).gpu.median, source: frames.source });
    console.log(`  ${name} #${round + 1} : ${frames.frames} images, ${frames.dropped} abandonnées sur ${frames.expected} ; dessin GPU ${draw.p50} ms (p95 ${draw.p95}) ; GPU de l'app ${summarizePass(gpu).gpu.median} %`);
  }
  const verres = await page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => { const f = getComputedStyle(el).backdropFilter; const r = el.getBoundingClientRect(); return f && f !== "none" && r.width > 0 && r.bottom > 0 && r.top < innerHeight; }).reduce((n, el) => ({ givres: n.givres + 1, courbes: n.courbes + (/lg-frost-curve/.test(getComputedStyle(el).backdropFilter) ? 1 : 0), lentilles: n.lentilles + (/url\(/.test(getComputedStyle(el).backdropFilter) && !/lg-frost-curve/.test(getComputedStyle(el).backdropFilter) ? 1 : 0) }), { givres: 0, courbes: 0, lentilles: 0 }));
  report.gestes[name] = {
    verres,
    images: median(passes.map((p) => p.presented)), attendues: median(passes.map((p) => p.expected)), abandonnees: passes.map((p) => p.dropped),
    dessinGpuP50: median(passes.map((p) => p.drawP50)), dessinGpuP95: median(passes.map((p) => p.drawP95)), gpuApp: median(passes.map((p) => p.gpu)), source: passes[0]?.source,
  };
}
console.log(JSON.stringify(report));
await browser.close();
