// Freiner l'émulateur d'un AVD Lite, sur un Mac Apple Silicon (ni cgroups, ni
// taskset) : deux leviers, appliqués au SEUL processus qemu de l'AVD (trouvé
// par sa console, jamais par un motif de ligne de commande).
//
// - `taskpolicy -b` : priorité d'arrière-plan de Darwin — le M4 ne l'exécute
//   que sur ses cœurs ÉCONOMES (`lib/host.mjs`, banc A6) ;
// - `duty:N` : qemu suspendu (SIGSTOP) puis relâché (SIGCONT) par un petit
//   processus du banc (`dutyCycle.mjs`), N % du temps en marche, sur des
//   périodes de 20 ms. Toute la machine virtuelle ralentit ; son horloge,
//   elle, continue : l'app voit un processeur plus lent, pas un temps figé.
//
// `cpulimit` (Homebrew, 0.2) a été essayé le 07/10 et ÉCARTÉ : sur macOS il
// lit la consommation de qemu à 1-2 % quand `ps` en voit 50 à 100 %, ne le
// suspend donc jamais — aucun effet mesurable (25 % plus rapide que rien).
//
// L'effet se MESURE (`measureThrottle`) : une même charge de calcul dans
// l'appareil, seule (un cœur) puis sur tous ses cœurs, sous chaque réglage.
import { execFileSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DUTY = path.join(path.dirname(fileURLToPath(import.meta.url)), "dutyCycle.mjs");

const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");

/** Le PID de qemu d'un émulateur : celui qui écoute sur sa console. */
export function qemuPidOf(serial) {
  const port = serial.replace(/^emulator-/, "");
  const pids = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).split("\n").filter(Boolean);
  for (const pid of pids) {
    const name = execFileSync("ps", ["-o", "comm=", "-p", pid], { encoding: "utf8" }).trim();
    if (/qemu-system/.test(name)) return Number(pid);
  }
  throw new Error(`aucun qemu n'écoute sur la console ${port}`);
}

/**
 * Pose un freinage ; rend la fonction qui le lève. `spec` : `none`,
 * `ecoe` (taskpolicy -b), `duty:<N>` (N % du temps en marche), ou `ecoe+duty:<N>`.
 */
export function applyThrottle(pid, spec = "none") {
  const undo = [];
  for (const part of spec.split("+")) {
    if (part === "none" || part === "") continue;
    if (part === "ecoe") {
      execFileSync("taskpolicy", ["-b", "-p", String(pid)]);
      undo.push(() => execFileSync("taskpolicy", ["-B", "-p", String(pid)]));
    } else if (part.startsWith("duty:")) {
      const percent = Number(part.slice(5));
      if (!(percent > 0 && percent < 100)) throw new Error(`freinage illisible : ${part} (1 à 99)`);
      const child = spawn(process.execPath, [DUTY, String(pid), String(percent)], { stdio: "ignore" });
      undo.push(() => {
        // Le cycle relâche (SIGCONT) qemu en sortant.
        child.kill("SIGTERM");
      });
    } else {
      throw new Error(`freinage inconnu : ${part} (none, ecoe, duty:<N>)`);
    }
  }
  return () => {
    for (const fn of undo.reverse()) {
      try {
        fn();
      } catch {
        // l'émulateur a pu s'éteindre
      }
    }
  };
}

/**
 * Une charge de calcul FIXE dans l'appareil (boucle du shell), lancée
 * `jobs` fois en parallèle ; rend sa durée en ms, mesurée par le Mac.
 */
export function cpuWork(serial, jobs, iterations = 50_000) {
  const loop = `i=0; while [ $i -lt ${iterations} ]; do i=$((i+1)); done`;
  const script = Array.from({ length: jobs }, () => `(${loop}) &`).join(" ") + " wait";
  const start = process.hrtime.bigint();
  execFileSync(ADB, ["-s", serial, "shell", script], { stdio: "ignore", timeout: 600_000 });
  return Number(process.hrtime.bigint() - start) / 1e6;
}

/** La charge du Mac (moyenne sur une minute). */
export const hostLoad = () => Math.round(os.loadavg()[0] * 10) / 10;

/** Chaque freinage mesuré : un cœur, puis tous, `rounds` fois ; le facteur par rapport à `none`. */
export async function measureThrottle(serial, specs, { rounds = 3, cores } = {}) {
  const pid = qemuPidOf(serial);
  const results = [];
  for (const spec of ["none", ...specs.filter((s) => s !== "none")]) {
    const lift = applyThrottle(pid, spec);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const single = [];
    const all = [];
    const loads = [];
    try {
      for (let i = 0; i < rounds; i++) {
        loads.push(hostLoad());
        single.push(cpuWork(serial, 1));
        all.push(cpuWork(serial, cores));
      }
    } finally {
      lift();
    }
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    results.push({ spec, singleMs: Math.round(median(single)), allMs: Math.round(median(all)), hostLoad: Math.max(...loads) });
  }
  const base = results[0];
  return results.map((r) => ({ ...r, singleFactor: +(r.singleMs / base.singleMs).toFixed(2), allFactor: +(r.allMs / base.allMs).toFixed(2) }));
}
