// L'orchestrateur du banc des bibliothèques — voir README.md.
//   node measure.mjs relaunch | cold
//   node measure.mjs open <étiquette> [ms]        ouverture depuis le rail (focus sur la bibliothèque)
//   node measure.mjs hold <étiquette> [s]         flèche BAS maintenue (≤ 10 s : l'agent ne tient pas plus)
//   node measure.mjs steps <étiquette> [n] [s]    n pas BAS à cadence fixe : le même travail pour toutes les versions
//   node measure.mjs trips <étiquette> [n]        n allers-retours de bout en bout (RAM, tas JS)
//   node measure.mjs ab <A> <B> [tours]           paquets figés A et B en alternance (client froid à chaque tour)
// `PROFILE=1` : profil Hermes du fil JS pendant `open` et `hold` (out/<étiquette>.cpuprofile).
import fs from "node:fs";
import path from "node:path";
import { analyze, ramSummary, summarizeProfile } from "./lib/analyze.mjs";
import {
  CONFIG, OUT, agent, appCpuMs, appPid, cdp, cdpRaw, coldClean, footprint, gpu, probeReport, relaunch,
  save, serverLog, serverReset, setBundle, sleep, startRam,
} from "./lib/device.mjs";

if (!CONFIG.udid) throw new Error("BENCH_UDID : l'UDID du simulateur du banc");

async function profiled(label, run) {
  if (!process.env.PROFILE) return run();
  await cdpRaw("Profiler.start");
  await run();
  const { profile } = await cdpRaw("Profiler.stop");
  if (!profile) return undefined;
  fs.writeFileSync(path.join(OUT, `${label}.cpuprofile`), JSON.stringify(profile));
  fs.writeFileSync(path.join(OUT, `${label}.profile.json`), JSON.stringify(summarizeProfile(profile), null, 1));
  return undefined;
}

/** Arme la sonde, joue `act`, désarme, relit le rapport — RAM relevée tout du long. */
async function measured(label, kind, act) {
  await serverReset();
  const ramFile = path.join(OUT, `${label}.ram.csv`);
  const stopRam = startRam(ramFile);
  await cdp(`__libProbe.arm(${JSON.stringify(label)})`);
  await sleep(300);
  const extra = await act();
  await cdp("__libProbe.disarm()");
  await sleep(300);
  stopRam();
  const rep = await probeReport(label);
  if (!rep) throw new Error(`rapport de la sonde introuvable pour « ${label} »`);
  rep.serverLog = await serverLog();
  rep.footprint = footprint();
  save(label, rep);
  const result = { ...analyze(rep, kind), ...extra, ram: ramSummary(ramFile), footprint: rep.footprint.total };
  fs.writeFileSync(path.join(OUT, `${label}.result.json`), JSON.stringify(result, null, 1));
  return result;
}

const open = (label, ms = 3500) => measured(label, "open", async () => {
  await profiled(label, async () => {
    await agent(["select"]);
    await sleep(ms);
  });
  return {};
});

const hold = (label, seconds = 8) => measured(label, "hold", async () => {
  const gpuP = gpu(seconds + 2).catch((e) => ({ error: String(e) }));
  await profiled(label, async () => {
    await agent([`holddown:${Math.min(10, seconds)}`]);
    await sleep(2500);
  });
  return { gpu: await gpuP };
});

const steps = (label, n = 30, every = 0.25) => measured(label, "hold", async () => {
  const gpuP = gpu(Math.round(n * every) + 1).catch((e) => ({ error: String(e) }));
  const pid = appPid();
  const c0 = appCpuMs(pid);
  const commands = [];
  for (let i = 0; i < n; i++) commands.push("down", `wait:${every}`);
  await agent(commands);
  await sleep(1500);
  return { cpuAppMs: Math.round(appCpuMs(pid) - c0), gpu: await gpuP };
});

/** Où en est la grille, et le tas JS (Hermes) : vivant et réservé. */
async function where() {
  try {
    return JSON.parse(await cdp("JSON.stringify((() => { const g = __libProbe.grid(); const h = HermesInternal.getInstrumentedStats(); return g && { offset: g.offset, lines: g.rows.length, jsLiveMB: Math.round(h.js_allocatedBytes / 1048576), jsHeapMB: Math.round(h.js_heapSize / 1048576) }; })())"));
  } catch {
    return null;
  }
}

/** Des appuis de 10 s enchaînés jusqu'à ce que la position ne bouge plus (le bout). */
async function untilEnd(direction) {
  let last = null;
  for (let k = 1; k <= 12; k++) {
    await agent([`hold${direction}:10`, "wait:1.5"]);
    const pos = await where();
    if (pos && last && Math.abs(pos.offset - last.offset) < 5) return { ...pos, holds: k };
    last = pos;
  }
  return { ...last, holds: 12 };
}

async function trips(label, n = 3) {
  const ramFile = path.join(OUT, `${label}.ram.csv`);
  const stopRam = startRam(ramFile);
  const legs = [{ at: "début", footprint: footprint().total, ...(await where()) }];
  for (let i = 1; i <= n; i++) {
    legs.push({ at: `bas ${i}`, ...(await untilEnd("down")), footprint: footprint().total });
    legs.push({ at: `haut ${i}`, ...(await untilEnd("up")), footprint: footprint().total });
  }
  stopRam();
  const result = { legs, ram: ramSummary(ramFile), categories: footprint().cats };
  fs.writeFileSync(path.join(OUT, `${label}.result.json`), JSON.stringify(result, null, 1));
  return result;
}

async function ab(a, b, rounds = 2) {
  for (let i = 1; i <= rounds; i++) {
    for (const version of [a, b]) {
      await setBundle(version);
      coldClean();
      await relaunch();
      await open(`${version}-open${i}`);
      await hold(`${version}-hold${i}`, 8);
      await relaunch();
      await agent(["select", "wait:4"]);
      await steps(`${version}-steps${i}`);
      console.log(`${version} : tour ${i} fait`);
    }
  }
  await setBundle("");
}

const [command, label, a1, a2] = process.argv.slice(2);
const print = (value) => console.log(JSON.stringify(value, null, 1));
switch (command) {
  case "relaunch": await relaunch(); break;
  case "cold": coldClean(); break;
  case "open": print(await open(label, a1 ? Number(a1) : undefined)); break;
  case "hold": print(await hold(label, a1 ? Number(a1) : undefined)); break;
  case "steps": print(await steps(label, a1 ? Number(a1) : undefined, a2 ? Number(a2) : undefined)); break;
  case "trips": print(await trips(label, a1 ? Number(a1) : undefined)); break;
  case "ab": await ab(label, a1, a2 ? Number(a2) : undefined); break;
  default: console.log("commandes : relaunch · cold · open · hold · steps · trips · ab (voir l'en-tête)");
}
