#!/usr/bin/env node
// Le DÉMARRAGE du lecteur d'Android TV, image par image : OK sur « Reprendre »
// (un MKV du banc, `lecteur/flux-*`), l'écran filmé (`screenrecord`) et le
// journal `TntStart` du moteur (prêt, première image, son qui avance) relevés
// ensemble ; puis, sur le film, chaque image classée — écran de chargement,
// vidéo, noir — et le moment où chacune change. Le faux backend et son relais
// tournent à côté (`bench.mjs serve`, même PERF_PORT) ; l'app est l'app de
// MESURE, la session du faux backend déjà écrite (`--session` l'écrit).
//
//   PERF_PORT=3012 node apps/tv/harness/android-perf/bench.mjs serve &
//   ANDROID_SERIAL=<ip>:5555 PERF_PACKAGE=com.tentacletv.mobile.perf PERF_PORT=3012 \
//     node apps/tv/harness/android-perf/startup.mjs --tag avant --sets flux-h264-ac3,flux-hevc-eac3 \
//     [--rounds 2] [--apk release.apk] [--session debug.apk]
//
// Résultats : ~/Library/Caches/tentacle-android-perf/startup/<tag>/.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KEY, PACKAGE, createDevice, sleep } from "./lib/device.mjs";
import { classifyFrames, summarizeStartup } from "./lib/startupFrames.mjs";

const PORT = Number(process.env.PERF_PORT ?? 3107);
const BACKEND_PORT = PORT + 10;
const rest = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const tag = option("tag") ?? "essai";
const sets = (option("sets") ?? "flux-h264-ac3").split(",");
const rounds = Number(option("rounds") ?? 1);
const OUT = path.join(os.homedir(), "Library/Caches/tentacle-android-perf/startup", tag);
const RECORD_S = Number(option("seconds") ?? 14);

const device = createDevice();
const ADB = path.join(process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk"), "platform-tools/adb");
const SERIAL = process.env.ANDROID_SERIAL ?? "emulator-5584";
const shell = (command) => device.adb(["shell", command]);
const key = (name) => shell(`input keyevent ${KEY[name]}`);
const mark = (text) => shell(`log -t TntStart '${text}'`);

function applyFixtures(set) {
  execFileSync("curl", ["-s", "-X", "POST", `http://127.0.0.1:${BACKEND_PORT}/__fixtures`, "-d", JSON.stringify({ sets: ["base/vigie-off", `lecteur/${set}`] })], { stdio: "ignore" });
}

/** Les lignes `TntStart` (et la bascule de fréquence), horodatées par logcat (`-v epoch`). */
function startLog() {
  const raw = device.adb(["logcat", "-d", "-v", "epoch", "-s", "TntStart:*", "TntDisplayMode:*"]);
  return raw.split("\n").map((line) => line.match(/^\s*(\d+\.\d+)\s+\d+\s+\d+\s+\w\s+(\w+)\s*:\s(.*)$/)).filter(Boolean)
    .map(([, epoch, tagName, text]) => ({ at: Number(epoch) * 1000, tag: tagName, text }));
}

async function playOnce(set, round) {
  applyFixtures(set);
  // Une Shield laissée seule se rendort entre deux lectures (et son adb réseau
  // avec, qui perd en revenant le relais vers le faux backend).
  shell("input keyevent KEYCODE_WAKEUP");
  device.adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
  device.forceStop();
  shell(`am start -W -n ${PACKAGE}/com.tentacletv.MainActivity`);
  await sleep(9000); // l'accueil, ses images, son héros
  // L'approche convergente de nav-golden : du héros comme du rail (entrée
  // perdue sous charge), GAUCHE puis DROITE ramènent au héros ; BAS : « Reprendre ».
  for (const name of ["left", "right", "down"]) {
    key(name);
    await sleep(700);
  }
  await sleep(1500);
  device.adb(["logcat", "-c"]);
  const remote = `/sdcard/tnt-startup.mp4`;
  shell(`rm -f ${remote}`);
  const recorder = spawn(ADB, ["-s", SERIAL, "shell", `screenrecord --bit-rate 16000000 --time-limit ${RECORD_S} ${remote}`], { stdio: "ignore" });
  await sleep(700);
  mark("film");
  await sleep(300);
  mark("ok");
  const okAt = Date.now();
  key("ok");
  await new Promise((resolve) => recorder.on("exit", resolve));
  const log = startLog();
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${set}-${round}.mp4`);
  device.adb(["pull", remote, file]);
  const frames = classifyFrames(file);
  const filmAt = log.find((l) => l.text === "film")?.at ?? okAt - 300;
  const summary = summarizeStartup({ set, round, frames, log, filmAt });
  fs.writeFileSync(path.join(OUT, `${set}-${round}.json`), JSON.stringify({ summary, log, frames }, null, 1));
  key("back");
  await sleep(1500);
  return summary;
}

// `--session <debug.apk>` : la session du faux backend écrite (debug, run-as),
// puis `--apk` (la release mesurée) installée par-dessus, données gardées.
if (option("session")) await device.writeSession({ debugApk: option("session"), port: PORT });
if (option("apk")) device.install(option("apk"));

const results = [];
for (let round = 1; round <= rounds; round++) {
  for (const set of sets) {
    const summary = await playOnce(set, round);
    results.push(summary);
    console.log(JSON.stringify(summary));
  }
}
device.forceStop();
fs.writeFileSync(path.join(OUT, "resume.json"), JSON.stringify(results, null, 1));
console.log(`→ ${OUT}`);
