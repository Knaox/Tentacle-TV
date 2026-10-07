// La MÉMOIRE dans la durée (tâche L6) : l'app lancée une fois, puis des tours
// d'endurance (`ENDURANCE_SEGMENTS`, vérifiés, sous la garde des touches), la
// mémoire relevée après chaque tour — PSS, tas Java et natif, objets `View`
// vivants (`dumpsys meminfo`, « Views ») ET vues ATTACHÉES (`gfxinfo`) : un
// écart qui grandit entre les deux, c'est une rétention. À la fin, au besoin,
// une capture du tas (`am dumpheap`, l'app de mesure est « profileable »),
// convertie au format J2SE (`hprof-conv`) pour l'analyse.
//
// Rien n'est mesuré en images : seule la mémoire compte ici. Le niveau de
// rendu se force par `--lite 1|0` (propriété `debug.tentacle.lite`, NIVEAU.md).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PACKAGE, sleep } from "../device.mjs";
import { createPlayer } from "../play.mjs";
import { createCapture } from "./capture.mjs";
import { hostLoad } from "./throttle.mjs";

const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const HPROF_CONV = path.join(SDK, "platform-tools/hprof-conv");

/** Une ligne de relevé : ce que le parcours écrit, plus les vues attachées. */
function sample(device, capture, label) {
  const app = capture.meminfo();
  const attached = device.viewHierarchy();
  return { label, at: new Date().toISOString(), hostLoad: hostLoad(), app, attachedViews: attached.views, displayListKb: attached.displayListKb, system: capture.system() };
}

function describe(s) {
  const a = s.app;
  return `${s.label} : PSS ${a.totalPss} Mo (Java ${a.javaHeap}, natif ${a.nativeHeap}, graphique ${a.graphics}) · View ${a.views} dont attachées ${s.attachedViews} · système dispo ${s.system.availableMb} Mo · charge ${s.hostLoad}`;
}

/** Capture du tas (GC forcé d'abord), rapatriée et convertie ; rend le chemin du .hprof J2SE. */
export function dumpHeap(device, file) {
  const remote = `/data/local/tmp/l6-${Date.now()}.hprof`;
  const pid = device.pid();
  if (!pid) throw new Error("app absente : pas de capture du tas");
  device.shell(`am dumpheap -g ${pid} ${remote}`, { timeout: 120_000 });
  // `am dumpheap` rend la main avant la fin de l'écriture : on attend une taille stable.
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const size = Number(device.shell(`stat -c %s ${remote} 2>/dev/null || echo -1`).trim());
    if (size > 0 && size === last) break;
    last = size;
    execFileSync("sleep", ["2"]);
  }
  const raw = `${file}.android`;
  device.adb(["pull", remote, raw], { timeout: 300_000 });
  device.shell(`rm -f ${remote}`);
  execFileSync(HPROF_CONV, [raw, file]);
  fs.rmSync(raw);
  return file;
}

export async function runMemory({ withLiteBench, avd, option, flag, runsDir, stamp, playEndurance }) {
  const apk = option("apk");
  const debugApk = option("debug-apk");
  const tag = option("tag");
  if (!apk || !debugApk || !tag) throw new Error("memoire run <avd> --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--tours 6] [--lite 1|0] [--heap] [--trim]");
  const loops = Number(option("tours", "6"));
  const lite = option("lite");
  const dir = path.join(runsDir, `${stamp()}-memoire-${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  const log = (line) => {
    console.log(line);
    fs.appendFileSync(path.join(dir, "journal.txt"), `${line}\n`);
  };
  await withLiteBench({ apk: null, debugApk }, async (device) => {
    const capture = createCapture(device.serial, PACKAGE);
    const player = createPlayer({ device, backendPort: 0, host: { measuring: (fn) => fn() } });
    if (lite !== null) device.shell(`setprop debug.tentacle.lite ${lite === "1" ? 1 : 0}`);
    log(`appareil : ${device.describe()} · ${avd ?? device.serial} · lite=${lite ?? "auto"} · charge ${hostLoad()}`);
    await player.prepareApk(apk);
    const result = { tag, avd, lite, date: new Date().toISOString(), apk, samples: [], died: null, drift: null, heap: null, trims: [] };
    try {
      device.forceStop();
      device.clearLog();
      device.launch();
      await device.waitReady("accueil", 90_000);
      await sleep(10_000);
      result.samples.push(sample(device, capture, "repos"));
      fs.writeFileSync(path.join(dir, "meminfo-repos.txt"), device.shell(`dumpsys meminfo ${PACKAGE}`));
      log(describe(result.samples.at(-1)));
      for (let loop = 1; loop <= loops; loop++) {
        const drift = await playEndurance(device);
        if (!device.pid()) {
          result.died = loop;
          log(`l'app est MORTE au tour ${loop} — morts relevées : ${JSON.stringify(capture.lmkKills().slice(-5))}`);
          break;
        }
        if (drift) {
          result.drift = drift;
          device.screencap(path.join(dir, `derive-tour${loop}.png`));
          log(`dérive au tour ${loop} : ${drift}`);
          break;
        }
        await sleep(3000);
        result.samples.push(sample(device, capture, `tour ${loop}`));
        fs.writeFileSync(path.join(dir, `meminfo-tour${loop}.txt`), device.shell(`dumpsys meminfo ${PACKAGE}`));
        log(describe(result.samples.at(-1)));
      }
      if (flag("trim") && device.pid()) {
        for (const level of ["RUNNING_LOW", "RUNNING_CRITICAL"]) {
          device.shell(`am send-trim-memory ${PACKAGE} ${level}`);
          await sleep(4000);
          result.trims.push(sample(device, capture, `après ${level}`));
          log(describe(result.trims.at(-1)));
        }
      }
      if (flag("heap") && device.pid()) {
        result.heap = dumpHeap(device, path.join(dir, "tas.hprof"));
        log(`tas : ${result.heap}`);
      }
    } finally {
      fs.writeFileSync(path.join(dir, "resume.json"), JSON.stringify(result, null, 1));
      log(`→ ${dir}`);
    }
  });
}

