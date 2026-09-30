// Le coût de rendu du simulateur du banc, sans sudo (`powermetrics` en
// demande un) : le temps GPU cumulé (`accumulatedGPUTime`, en ns) que le
// pilote AGX tient pour chaque client, relevé sur les services de rendu HÔTES
// de ce simulateur — SimRenderServer et SimMetalHost, nés avec son
// launchd_sim — plus le CPU de son backboardd (le serveur Core Animation de
// l'appareil simulé) et de l'app. Les autres simulateurs démarrés, les autres
// sessions, le reste du Mac : hors du compte.
//
// C'est le GPU du Mac qui rend l'Apple TV simulée : on compare des RAPPORTS
// (avec ou sans verre), jamais des valeurs absolues d'appareil.
import { execFileSync } from "node:child_process";

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });

function processes() {
  return sh("ps", ["-Ao", "pid=,ppid=,lstart=,command="])
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), start: Date.parse(m[3]), command: m[4] }));
}

/** Les processus d'un simulateur démarré : services de rendu, backboardd, app. */
function simulatorProcesses(udid) {
  const all = processes();
  const launchd = all.find((p) => p.command.startsWith("launchd_sim ") && p.command.includes(udid));
  if (!launchd) throw new Error(`simulateur ${udid} éteint`);
  // Les services de rendu hôtes naissent dans les deux secondes qui précèdent son launchd_sim.
  const render = all.filter((p) => /SimRenderServer|SimMetalHost/.test(p.command) && Math.abs(p.start - launchd.start) <= 2000);
  if (!render.length) throw new Error("services de rendu du simulateur introuvables");
  const child = (suffix) => all.find((p) => p.ppid === launchd.pid && p.command.endsWith(suffix))?.pid;
  return { render: render.map((p) => p.pid), backboardd: child("/backboardd"), app: child("/TentacleTV") };
}

function gpuNs(pids) {
  const out = sh("ioreg", ["-l", "-w", "0", "-c", "AGXDeviceUserClient"]);
  let total = 0;
  for (const block of out.split("+-o AGXDeviceUserClient").slice(1)) {
    const pid = Number(block.match(/"IOUserClientCreator" = "pid (\d+),/)?.[1]);
    if (!pids.includes(pid)) continue;
    for (const m of block.matchAll(/"accumulatedGPUTime"=(\d+)/g)) total += Number(m[1]);
  }
  return total;
}

/** Temps CPU cumulé d'un processus, en ms (`time` de ps : m:ss.cc). */
function cpuMs(pid) {
  if (!pid) return 0;
  const [minutes, secs] = sh("ps", ["-o", "time=", "-p", String(pid)]).trim().split(":");
  return (Number(minutes) * 60 + Number(secs)) * 1000;
}

/** Le coût moyen sur `seconds` secondes : GPU et CPU en ms par seconde. */
export async function measureGpu(udid, seconds) {
  const procs = simulatorProcesses(udid);
  const read = () => ({ gpu: gpuNs(procs.render), bb: cpuMs(procs.backboardd), app: cpuMs(procs.app), at: Date.now() });
  const start = read();
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const end = read();
  const elapsed = (end.at - start.at) / 1000;
  const rate = (a, b, scale = 1) => Number(((b - a) / scale / elapsed).toFixed(1));
  return {
    seconds: Number(elapsed.toFixed(1)),
    gpuMsPerS: rate(start.gpu, end.gpu, 1e6),
    backboarddCpuMsPerS: rate(start.bb, end.bb),
    appCpuMsPerS: rate(start.app, end.app),
  };
}
