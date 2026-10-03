// Banc de référence de la navigation Apple TV — chemins, ports, sortie.
//
// Le banc tourne depuis N'IMPORTE QUEL dossier de travail : le « dossier
// courant » est celui qui porte ce fichier ; le « dossier principal » est le
// premier de `git worktree list` (celui dont les node_modules sont installés).
// Tout ce qui se partage entre sessions (checkouts de référence, builds natifs,
// agent XCUITest) vit HORS des dépôts, dans un cache de la machine.
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BENCH_DIR = path.resolve(HERE, "..");
export const REPO = path.resolve(BENCH_DIR, "../../../..");
export const SCENARIOS_DIR = path.join(BENCH_DIR, "scenarios");
export const OUT_DIR = path.join(BENCH_DIR, "out");
export const CACHE_DIR = process.env.NAV_GOLDEN_CACHE ?? path.join(os.homedir(), "Library/Caches/tentacle-nav-golden");
export const BUNDLE_ID = "com.tentacle.mobile";
export const ATV_REMOTE_DIR = path.join(REPO, "apps/tv/harness/atv-remote");

/** Une erreur expliquée à l'auteur du scénario, sans pile. */
export class BenchError extends Error {}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Sortie ──────────────────────────────────────────────────────────────────

const QUIET = process.env.NAV_GOLDEN_QUIET === "1";
export const say = (text = "") => console.log(text);
export const step = (label, text) => !QUIET && console.log(`▸ ${label} : ${text}`);
export const note = (text) => !QUIET && console.log(`    ${text}`);
export const warn = (text) => console.log(`  ⚠ ${text}`);

export function duration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

// ─── Commandes ───────────────────────────────────────────────────────────────

/** Sortie d'une commande courte ; `null` si elle échoue. */
export function capture(command, args, options = {}) {
  try {
    const stdin = options.input === undefined ? "ignore" : "pipe";
    return execFileSync(command, args, { encoding: "utf8", stdio: [stdin, "pipe", "pipe"], maxBuffer: 64 << 20, ...options });
  } catch {
    return null;
  }
}

/** Le dossier principal du dépôt : celui qui porte l'installation pnpm. */
export function mainCheckout() {
  const list = capture("git", ["-C", REPO, "worktree", "list", "--porcelain"]) ?? "";
  const first = list.split("\n").find((line) => line.startsWith("worktree "));
  return first ? first.slice("worktree ".length) : REPO;
}

/** Le SHA complet d'une révision (`null` si elle n'existe pas). */
export function resolveSha(rev) {
  return capture("git", ["-C", REPO, "rev-parse", "--verify", `${rev}^{commit}`])?.trim() ?? null;
}

// ─── Ports : une « place » par session ───────────────────────────────────────

/**
 * Les ports d'une place `n` (la convention du lot : Metro 818n, CDP 923n,
 * faux backend 310n ; l'agent XCUITest 875n en TCP et 876n en HTTP). Chaque
 * session a sa place, son simulateur cloné, et ne touche jamais à celles des
 * autres. Un port se force un par un (`NAV_GOLDEN_METRO`…).
 */
export function slotPorts(slot) {
  const env = (name, fallback) => Number(process.env[`NAV_GOLDEN_${name}`] ?? fallback);
  return {
    slot,
    metro: env("METRO", 8180 + slot),
    cdp: env("CDP", 9230 + slot),
    backend: env("BACKEND", 3100 + slot),
    agentTcp: env("AGENT_TCP", 8750 + slot),
    agentHttp: env("AGENT_HTTP", 8760 + slot),
  };
}

/** Les options communes de la ligne de commande : `--slot`, `--sim`, `--device`. */
export function benchContext(options) {
  const slot = Number(options.slot ?? process.env.NAV_GOLDEN_SLOT ?? NaN);
  if (!Number.isInteger(slot) || slot < 0 || slot > 9) {
    throw new BenchError("indiquer sa place : --slot <0-9> (ou NAV_GOLDEN_SLOT) — la place n donne les ports 818n, 923n, 310n, 875n, 876n");
  }
  const sim = options.sim ?? process.env.NAV_GOLDEN_SIM ?? `nav-T${slot}`;
  return {
    ports: slotPorts(slot),
    sim,
    // L'Apple TV physique (« Chambre », ou NAV_GOLDEN_DEVICE_UDID / _COREDEVICE) : le passage « appareil ».
    device: options.device === true || process.env.NAV_GOLDEN_DEVICE === "1",
    stateFile: path.join(CACHE_DIR, "slots", `${slot}.json`),
    logDir: path.join(CACHE_DIR, "slots", `${slot}-logs`),
  };
}
