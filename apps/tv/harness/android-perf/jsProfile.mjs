#!/usr/bin/env node
// Le PROFIL du fil JS pendant un geste, sur l'app DEBUG servie par Metro : le
// profileur échantillonneur de Hermes, par le débogueur (CDP) de Metro. Il
// dit où part le temps du JS — un rendu React, un crochet, une requête — là
// où le mode de mesure ne dit que combien de composants se sont rendus.
//
//   node apps/tv/harness/android-perf/jsProfile.mjs --metro 8091 --keys "tap:22x6@550" [--out profil.cpuprofile] [--top 25]
//
// L'app debug doit être DEVANT, placée où le geste part ; les touches sont
// jouées par l'injecteur du banc (`keys/Keys.java`, déjà poussé par `run`).
// Les durées d'un build debug sont gonflées (React de développement) : on y
// lit les PROPORTIONS et les noms, les durées se mesurent en release.
import fs from "node:fs";
import { createDevice, sleep } from "./lib/device.mjs";

const args = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const metro = Number(option("metro", "8091"));
const keys = (option("keys") ?? "").split(/\s+/).filter(Boolean);
const top = Number(option("top", "25"));

async function target() {
  const list = await (await fetch(`http://127.0.0.1:${metro}/json/list`)).json();
  const page = list.find((t) => /React Native|Hermes/i.test(`${t.title} ${t.description}`)) ?? list[0];
  if (!page) throw new Error(`aucune cible de débogage sur Metro ${metro} (app debug lancée ?)`);
  return page.webSocketDebuggerUrl;
}

function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      socket.send(JSON.stringify({ id: n, method, params }));
    });
  return { ready, send, close: () => socket.close() };
}

/** Le temps PROPRE de chaque fonction (ms), à partir des échantillons. */
function selfTimes(profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const counts = new Map();
  for (const sample of profile.samples) counts.set(sample, (counts.get(sample) ?? 0) + 1);
  const total = profile.samples.length;
  const span = (profile.endTime - profile.startTime) / 1000;
  const rows = new Map();
  for (const [nodeId, count] of counts) {
    const frame = byId.get(nodeId)?.callFrame;
    if (!frame) continue;
    const name = `${frame.functionName || "(anonyme)"} ${frame.url ? frame.url.split("/").slice(-2).join("/") : ""}:${frame.lineNumber}`;
    rows.set(name, (rows.get(name) ?? 0) + count);
  }
  return { span, total, rows: [...rows.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => [name, (n / total) * span]) };
}

async function main() {
  const cdp = connect(await target());
  await cdp.ready;
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
  await cdp.send("Profiler.start");
  const device = createDevice();
  device.keys(...keys);
  await sleep(1500);
  const { result } = await cdp.send("Profiler.stop");
  cdp.close();
  const out = option("out");
  if (out) fs.writeFileSync(out, JSON.stringify(result.profile));
  const { span, rows } = selfTimes(result.profile);
  const idle = rows.filter(([name]) => /^\((idle|program|garbage collector)\)/.test(name)).reduce((n, [, ms]) => n + ms, 0);
  console.log(`profil : ${Math.round(span)} ms, dont ${Math.round(span - idle)} ms de JS hors repos`);
  for (const [name, ms] of rows.slice(0, top)) console.log(`${ms.toFixed(1).padStart(8)} ms  ${name}`);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
