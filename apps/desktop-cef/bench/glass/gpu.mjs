// Coût du verre natif du lecteur, SANS sudo : phases alternées (verre natif posé / retiré par
// `liquidGlass.setEnabled`, contrôles affichés, même lecture), temps GPU cumulé PAR PROCESSUS
// (`ioreg`, clients AGX : WindowServer, qui compose le verre, et Tentacle), images perdues de mpv.
// La méthode du lecteur d'Electron (`docs/LIQUID-GLASS.md`, « Coût, mesuré »).
//   PONT_CDP_PORT=9429 node bench/glass/gpu.mjs [secondes par phase] [paires]
// ⚠️ Une fenêtre que macOS ne compose pas (autre bureau, écran verrouillé) ne coûte rien à
// WindowServer : le banc le dit (`onscreen`) au lieu d'un faux 0.
import { execFileSync } from "node:child_process";
import { findItem, sleep } from "../../web/shim/dev/drive.mjs";
import { drive } from "../pip/pip-drive.mjs";

const seconds = Number(process.argv[2] ?? 8);
const pairs = Number(process.argv[3] ?? 3);
const d = await drive();
const { cdp } = d;
// Le processus de L'app pilotée : celui qui écoute sur son port DevTools (jamais « le plus
// récent » : d'autres sessions ont la même ligne de commande).
const port = process.env.PONT_CDP_PORT ?? "9429";
const appPid = Number(execFileSync("lsof", ["-t", "-a", `-iTCP:${port}`, "-sTCP:LISTEN"]).toString().trim().split("\n")[0]);

/** Temps GPU cumulé (ns) par pid, tous clients AGX confondus. */
function gpuTimes() {
  const out = execFileSync("ioreg", ["-l", "-w0", "-r", "-c", "AGXDeviceUserClient"], { maxBuffer: 64 << 20 }).toString();
  const times = new Map();
  let pid = null;
  for (const line of out.split("\n")) {
    const creator = /"IOUserClientCreator" = "pid (\d+), ([^"]*)"/.exec(line);
    if (creator) pid = { id: Number(creator[1]), name: creator[2] };
    const usage = /"AppUsage" = \((.*)\)/.exec(line);
    if (usage && pid) {
      const total = [...usage[1].matchAll(/"accumulatedGPUTime"=(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
      times.set(pid.id, { name: pid.name, ns: (times.get(pid.id)?.ns ?? 0) + total });
    }
  }
  return times;
}
const tentaclePids = () => [appPid, ...execFileSync("pgrep", ["-P", String(appPid)]).toString().trim().split("\n").map(Number)];
const sum = (times, pids) => pids.reduce((s, p) => s + (times.get(p)?.ns ?? 0), 0);
const windowServer = () => Number(execFileSync("pgrep", ["-x", "WindowServer"]).toString().trim());
const prop = (name) => d.prop(name, "int64");

if (!(await d.path()).startsWith("/watch/")) {
  await d.playFromDetail((await findItem(process.env.GLASS_TITLE ?? "Banc Pistes SDR")).item.Id);
  await sleep(2000);
}
const { w, h } = await cdp.eval("({ w: innerWidth, h: innerHeight })");
const keepControls = async (ms) => {
  const end = Date.now() + ms;
  for (let i = 0; Date.now() < end; i++) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: w / 2 + (i % 2) * 8, y: h / 2 });
    await sleep(600);
  }
};

const ws = windowServer();
const rows = [];
for (let p = 0; p < pairs * 2; p++) {
  const on = p % 2 === 0;
  await cdp.eval(`window.tentacle.liquidGlass.setEnabled(${on})`);
  await keepControls(1200);  // le lot arrive, les fondus finissent
  const snap = await cdp.eval("__shell.invoke('liquidGlass.debug.snapshot')");
  if (!snap.windowVisible) console.log("⚠️ fenêtre NON composée (autre bureau ?) : WindowServer ne paie rien, la mesure ne vaut pas");
  const before = gpuTimes();
  const drops0 = [await prop("frame-drop-count"), await prop("vo-delayed-frame-count")];
  const t0 = Date.now();
  await keepControls(seconds * 1000);
  const elapsed = (Date.now() - t0) * 1e6;
  const after = gpuTimes();
  const drops1 = [await prop("frame-drop-count"), await prop("vo-delayed-frame-count")];
  const pct = (pids) => (100 * (sum(after, pids) - sum(before, pids))) / elapsed;
  const row = { verre: on, vues: snap.nativeViews, windowServer: pct([ws]), tentacle: pct(tentaclePids()),
    perdues: (drops1[0] ?? 0) - (drops0[0] ?? 0), retardees: (drops1[1] ?? 0) - (drops0[1] ?? 0) };
  rows.push(row);
  console.log(`${on ? "avec" : "sans"} verre (${row.vues} vues) : WindowServer ${row.windowServer.toFixed(1)} %, Tentacle ${row.tentacle.toFixed(1)} %, images perdues ${row.perdues}, retardées ${row.retardees}`);
}
await cdp.eval("window.tentacle.liquidGlass.setEnabled(true)");
const mean = (on, key) => rows.filter((r) => r.verre === on).reduce((s, r) => s + r[key], 0) / pairs;
console.log(`\nmoyennes — WindowServer : avec ${mean(true, "windowServer").toFixed(1)} %, sans ${mean(false, "windowServer").toFixed(1)} % ; `
  + `Tentacle : avec ${mean(true, "tentacle").toFixed(1)} %, sans ${mean(false, "tentacle").toFixed(1)} %`);
