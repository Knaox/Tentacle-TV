#!/usr/bin/env node
// Banc « écran noir » (Linux) : ce qui mène à une page noire ou figée, et ce que la coquille
// en fait. Sur la page du banc « gel » (bench/gel/page). Voir README.md.
//
//   node noir.mjs page  [--port 9411]   la page est-elle AFFICHÉE et vivante ? (après un lancement)
//   node noir.mjs rendu [--port 9411]   tue le processus de rendu (deux fois) : rechargée ?
//   node noir.mjs gpu   [--port 9411]   tue le processus GPU (une fois) : l'image revient ?
//
// Sortie en erreur si la page n'est pas affichée à la fin.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(path.join(here, "../../web/shim/dev/cdp.mjs"));
const scenario = process.argv[2];
const portAt = process.argv.indexOf("--port");
const port = Number(portAt > 0 ? process.argv[portAt + 1] : 9411);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const soon = (promise, ms) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error("sans réponse")), ms))]);

/** Les processus de Chromium, d'après lui (`SystemInfo.getProcessInfo`, cible navigateur). */
async function processes() {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await Cdp.connect(version.webSocketDebuggerUrl);
  const { processInfo } = await browser.send("SystemInfo.getProcessInfo");
  browser.close();
  return processInfo;
}
const pidOf = async (type) => (await processes()).find((p) => p.type === type)?.id ?? null;

/** La page est-elle affichée et vivante ? Images reçues en 1 s, pixel d'un bouton, clic. */
async function pageState() {
  const out = { displayed: false };
  try {
    const cdp = await Cdp.connect((await pageTarget(port)).webSocketDebuggerUrl);
    try {
      const shell = (channel, params = {}) => soon(cdp.eval(`__shell.invoke(${JSON.stringify(channel)}, ${JSON.stringify(params)})`), 3000);
      const before = await shell("shell.stats");
      await sleep(1000);
      const after = await shell("shell.stats");
      out.viewFramesPerS = after.viewFrames - before.viewFrames;
      out.presentedPerS = after.presentedFrames - before.presentedFrames;
      out.layers = await shell("shell.debug.layers");
      const scale = await soon(cdp.eval("devicePixelRatio"), 3000);
      const at = await soon(cdp.eval("__bench.rect('b0')"), 3000);
      const px = await shell("shell.debug.webPixel", { x: Math.round((at.x - 60) * scale), y: Math.round(at.y * scale) });
      out.buttonPixel = `rgba(${px.r},${px.g},${px.b},${px.a})`;
      // Un clic (CDP) arrive-t-il à la page ?
      await soon(cdp.eval("__bench.reset()"), 3000);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await cdp.send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
      }
      await sleep(150);
      out.clicks = await soon(cdp.eval("__bench.clicks.length"), 3000);
      out.url = await soon(cdp.eval("location.href"), 3000);
      // Le violet du bouton (#7c3aed) : la page est bien celle qu'on voit, pas un fond noir.
      out.displayed = out.viewFramesPerS > 0 && out.presentedPerS > 0 && px.r === 124 && px.g === 58 && px.b === 237 && out.clicks === 1;
    } catch (e) {
      out.page = e.message;
    }
    cdp.close();
  } catch (e) {
    out.cdp = e.message;
  }
  return out;
}

const report = (label, state) => console.log(`${label} : ${state.displayed ? "page AFFICHÉE" : "page NOIRE, FIGÉE ou MORTE"} ${JSON.stringify(state)}`);

let last;
if (scenario === "page") {
  last = await pageState();
  report("lancement", last);
} else if (scenario === "rendu") {
  report("avant", await pageState());
  // Une route à part, pour voir QUELLE page revient (la même, puis l'accueil).
  const cdp = await Cdp.connect((await pageTarget(port)).webSocketDebuggerUrl);
  await cdp.eval("history.pushState({}, '', '/une/route')");
  cdp.close();
  for (const round of [1, 2]) {
    const pid = await pidOf("renderer");
    if (pid === null) {
      console.log(`rendu tué (${round}) : plus aucun processus de rendu — la page n'a pas été rechargée`);
      break;
    }
    process.kill(pid, "SIGKILL");
    await sleep(round === 1 ? 2500 : 4000);
    last = await pageState();
    report(`rendu tué (${round}, pid ${pid})`, last);
  }
} else if (scenario === "gpu") {
  report("avant", await pageState());
  const pid = await pidOf("GPU");
  process.kill(pid, "SIGKILL");
  await sleep(3000);
  last = await pageState();
  report(`GPU tué (pid ${pid})`, last);
} else {
  console.error("usage : node noir.mjs page|rendu|gpu [--port 9411]");
  process.exit(2);
}
process.exit(last.displayed ? 0 : 1);
