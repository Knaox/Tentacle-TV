// Ce que le banc observe de L'EXTÉRIEUR de l'app : fenêtres réelles, captures,
// charge du GPU. Rien ici ne passe par la page.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Compile `windows.swift` une fois (dans le dossier d'état), rend son chemin. */
function windowsTool(stateDir) {
  const bin = path.join(stateDir, "bin/windows");
  if (!existsSync(bin)) {
    mkdirSync(path.dirname(bin), { recursive: true });
    execFileSync("swiftc", ["-O", path.join(HERE, "windows.swift"), "-o", bin], { stdio: "inherit" });
  }
  return bin;
}

/** Les fenêtres du processus, telles que le serveur de fenêtres les voit. */
export function windowsOf(stateDir, pid) {
  return JSON.parse(execFileSync(windowsTool(stateDir), [String(pid)], { encoding: "utf8" }));
}

/**
 * La fenêtre principale : la plus grande à l'écran, couche 0. Le titre est vide
 * sans l'autorisation d'enregistrement d'écran : on ne s'y fie pas.
 */
export function mainWindow(stateDir, pid) {
  const candidates = windowsOf(stateDir, pid).filter((w) => w.onscreen && w.layer === 0 && w.width > 400);
  candidates.sort((a, b) => b.width * b.height - a.width * a.height);
  return candidates[0] ?? null;
}

/**
 * Capture d'UNE fenêtre (`-l`, sans ombre `-o`) : ce que la page et le verre
 * natif de cette fenêtre composent. La fenêtre Metal de mpv (Apple Silicon) est
 * une fenêtre FILLE de la nôtre : `-l` la compose avec la page.
 */
export function captureWindow(windowId, file) {
  const r = spawnSync("screencapture", ["-x", "-o", "-l", String(windowId), file]);
  if (r.status !== 0) throw new Error(`screencapture -l ${windowId} : ${String(r.stderr)}`);
  return file;
}

// Jamais `screencapture -R` : une capture de l'ÉCRAN montre les autres
// applications à travers une fenêtre transparente (incident du 21/10). `-l`
// sur NOTRE fenêtre prend ses fenêtres filles — mpv compris — et rien d'autre.

/** Un relevé de charge du GPU (Apple Silicon : IOAccelerator, sans sudo). */
export function gpuSample() {
  const text = execFileSync("ioreg", ["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"], { encoding: "utf8" });
  const pick = (key) => Number(new RegExp(`"${key}"=(\\d+)`).exec(text)?.[1] ?? NaN);
  return { device: pick("Device Utilization %"), renderer: pick("Renderer Utilization %"), tiler: pick("Tiler Utilization %") };
}

/**
 * `seconds` relevés à 1 Hz ; rend moyenne et maximum de « Device Utilization ».
 * ⚠️ Mesure de TOUTE la machine (les autres sessions comptent) : à comparer
 * d'une cellule de la matrice à l'autre dans une même passe, jamais dans l'absolu.
 * `powermetrics` (watts) exige sudo : la passe GPU officielle reste à Damien.
 */
export async function gpuWindow(seconds) {
  const samples = [];
  for (let i = 0; i < seconds; i++) {
    samples.push(gpuSample().device);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const valid = samples.filter(Number.isFinite);
  const mean = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
  return { mean: Math.round(mean * 10) / 10, max: Math.max(...valid), samples };
}

/** Secondes depuis le dernier geste clavier/souris de Damien (IOHIDSystem). */
export function hidIdleSeconds() {
  const text = execFileSync("ioreg", ["-c", "IOHIDSystem"], { encoding: "utf8" });
  const raw = /"HIDIdleTime" = (\d+)/.exec(text)?.[1];
  return raw ? Number(raw) / 1e9 : 0;
}

/**
 * LOT.md : « ne jamais voler le clavier de Damien » — rien qui ouvre une
 * fenêtre ou change d'espace tant qu'il a touché clavier ou souris depuis
 * moins de `seconds`. Attend, au plus `timeoutMs` ; rend false si toujours actif.
 */
export async function waitHidIdle(seconds = 120, timeoutMs = 60 * 60_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (hidIdleSeconds() >= seconds) return true;
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/** Charge de la machine (les mesures ne valent rien au-delà de ~20). */
export function loadAverage() {
  return Number(execFileSync("sysctl", ["-n", "vm.loadavg"], { encoding: "utf8" }).split(" ")[1]);
}
