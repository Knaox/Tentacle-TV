#!/usr/bin/env node
// Le départ du lecteur, mesuré dans la coquille : de `mpv_init` à la première image, avec et
// sans préchauffage (`mpv_prewarm`, Linux — src/bridge/video_prewarm.h), et ce que le fil
// principal a retenu pendant ce temps. Sur une page IMMOBILE servie sous tentacle://app
// (bench/lecteur/page : l'instance ne naît qu'au repos de la page) ; fichier LOCAL, pour ne
// mesurer que la sortie vidéo.
//
//   node depart.mjs --port 9411 --file /chemin/clip.mkv [--rounds 4] [--prewarm] [--gap 5000]
//
// --prewarm : la page demande l'instance d'avance (comme `playerWarmup.ts`), puis `mpv_init`
// aux MÊMES options ; entre deux départs, --gap ms (plus que le repos exigé, 3 s) laissent le
// recyclage faire naître la suivante.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(path.join(here, "../../web/shim/dev/cdp.mjs"));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const port = Number(arg("port", 9411));
const file = arg("file");
const rounds = Number(arg("rounds", 4));
const gap = Number(arg("gap", 5000));
const prewarm = process.argv.includes("--prewarm");
if (!file) throw new Error("--file <vidéo locale>");

const cdp = await Cdp.connect((await pageTarget(port)).webSocketDebuggerUrl);
const rows = await cdp.eval(`(async () => {
  const t = window.tentacle;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const options = { initialOptions: { vo: "gpu-next", hwdec: "auto", "keep-open": "yes" }, observedProperties: [["time-pos", "double"]] };
  const rows = [];
  if (${prewarm}) {
    if (!t.capabilities.includes("mpv_prewarm")) return [{ error: "la coquille ne déclare pas mpv_prewarm" }];
    rows.push({ prewarm: await t.invoke("mpv_prewarm", { options }) });
    await sleep(${gap});
  }
  for (let i = 0; i < ${rounds}; i++) {
    const marks = {};
    await __shell.invoke("shell.debug.stalls", { reset: true });
    const t0 = performance.now();
    const off = t.on("mpv://event", (e) => {
      if (e && e.event === "file-loaded" && !marks.loaded) marks.loaded = performance.now() - t0;
      if (e && e.event === "playback-restart" && !marks.image) marks.image = performance.now() - t0;
    });
    await t.invoke("mpv_init", { options });
    marks.init = performance.now() - t0;
    await t.invoke("mpv_command", { name: "loadfile", args: [${JSON.stringify(file)}] });
    for (let k = 0; k < 200 && !marks.image; k++) await sleep(25);
    await sleep(400);
    marks.timePos = await t.invoke("mpv_get_property", { name: "time-pos", format: "double" });
    marks.stall = (await __shell.invoke("shell.debug.stalls")).maxMs;
    off();
    rows.push(Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 100) / 100 : v])));
    await t.invoke("mpv_destroy", {});
    await sleep(${gap});
  }
  return rows;
})()`);
cdp.close();
let n = 0;
for (const r of rows) {
  if (r.error) { console.error(r.error); process.exit(2); }
  if (r.prewarm !== undefined) { console.log(`préchauffage demandé : ${r.prewarm}`); continue; }
  console.log(`départ ${++n} : mpv_init rendu en ${Math.round(r.init)} ms · fichier chargé ${Math.round(r.loaded ?? -1)} ms · première image ${Math.round(r.image ?? -1)} ms · lecture à ${r.timePos} s · fil principal retenu au pire ${Math.round(r.stall)} ms pendant le départ`);
}
