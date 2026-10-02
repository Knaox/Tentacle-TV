// Ce que l'orchestrateur du banc pilote : l'agent XCUITest (`atv-remote`), le
// runtime JS par CDP (son démon `cdpd.mjs`), le simulateur, le faux serveur ;
// et ce qu'il relève de l'extérieur : RAM (`footprint`, `proc_pid_rusage`),
// GPU du simulateur (`ui-bench/tools/gpuCost.mjs`).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BENCH = path.dirname(HERE);
export const OUT = process.env.BENCH_OUT ?? path.join(BENCH, "out");
fs.mkdirSync(OUT, { recursive: true });

const env = (name, fallback) => process.env[name] ?? fallback;
export const CONFIG = {
  udid: env("BENCH_UDID", ""),
  server: Number(env("BENCH_PORT", 8660)),
  agent: Number(env("AGENT_HTTP", 8766)),
  cdpd: Number(env("CDPD_PORT", 8767)),
  library: env("BENCH_LIBRARY", "Films"),
};
const BUNDLE_ID = "com.tentacle.mobile";
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function agent(commands) {
  const res = await fetch(`http://127.0.0.1:${CONFIG.agent}/run`, { method: "POST", body: JSON.stringify(commands) });
  return res.json();
}
export const focusedLabel = async () => (await agent(["focus"]))[0]?.info?.split("|")[1] ?? "";

export async function cdp(expression) {
  const res = await fetch(`http://127.0.0.1:${CONFIG.cdpd}/eval`, { method: "POST", body: expression });
  return res.text();
}
/** Une méthode CDP brute — le démon de ce banc l'accepte sur /cdp. */
export async function cdpRaw(method, params) {
  const res = await fetch(`http://127.0.0.1:${CONFIG.cdpd}/cdp`, { method: "POST", body: JSON.stringify({ method, params }) });
  return res.json();
}

const server = (p) => `http://localhost:${CONFIG.server}${p}`;
export const serverReset = () => fetch(server("/__reset"));
export const serverLog = async () => (await fetch(server("/__log"))).text();
export const setBundle = (name) => fetch(server(`/__mode?bundle=${encodeURIComponent(name ?? "")}`));
/**
 * Le rapport de la sonde, envoyé au faux serveur puis relu. Un envoi qui a
 * échoué laisserait relire le rapport PRÉCÉDENT (piège payé) : on vérifie
 * qu'il porte bien l'étiquette de la mesure, sinon `null`.
 */
export async function probeReport(label) {
  await cdp(`__libProbe.post(${JSON.stringify(server("/__probe"))})`);
  await sleep(500);
  const rep = await (await fetch(server("/__probe"))).json();
  return rep && rep.label === label ? rep : null;
}

export function appPid() {
  const out = execFileSync("ps", ["-Ao", "pid=,command="], { encoding: "utf8" });
  const line = out.split("\n").find((l) => l.includes(CONFIG.udid) && l.includes("TentacleTV.app/TentacleTV"));
  return line ? Number(line.trim().split(/\s+/)[0]) : null;
}
/** Temps CPU cumulé de l'app (tous fils), en ms. */
export function appCpuMs(pid = appPid()) {
  const [m, s] = execFileSync("ps", ["-o", "time=", "-p", String(pid)], { encoding: "utf8" }).trim().split(":");
  return (Number(m) * 60 + Number(s)) * 1000;
}
/** Relevé d'empreinte (phys_footprint) toutes les `interval` ms ; rend l'arrêt. */
export function startRam(file, pid = appPid(), interval = 250) {
  const child = spawn("python3", [path.join(BENCH, "tools/ramsampler.py"), String(pid), String(interval), file], { stdio: "ignore" });
  return () => child.kill("SIGTERM");
}
export function footprint(pid = appPid()) {
  const text = execFileSync("footprint", [String(pid)], { encoding: "utf8" });
  const cats = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\d.]+ ?[KMG]?B)\s+([\d.]+ ?[KMG]?B)\s+([\d.]+ ?[KMG]?B)\s+(\d+)\s+(.+)$/);
    if (m) cats[m[5].trim()] = m[1].replace(" ", "");
  }
  return { total: text.match(/Footprint: ([\d.]+ \w+)/)?.[1], cats };
}
export async function gpu(seconds) {
  const { measureGpu } = await import(path.join(BENCH, "../ui-bench/tools/gpuCost.mjs"));
  return measureGpu(CONFIG.udid, seconds);
}

/** Client froid : app arrêtée, cache HTTP (affiches) et cache de requêtes persisté vidés. */
export function coldClean() {
  const data = execFileSync("xcrun", ["simctl", "get_app_container", CONFIG.udid, BUNDLE_ID, "data"], { encoding: "utf8" }).trim();
  execFileSync("xcrun", ["simctl", "terminate", CONFIG.udid, BUNDLE_ID], { stdio: "ignore" });
  const caches = path.join(data, "Library/Caches", BUNDLE_ID);
  for (const name of fs.existsSync(caches) ? fs.readdirSync(caches) : []) {
    if (name.startsWith("Cache.db") || name === "fsCachedData") fs.rmSync(path.join(caches, name), { recursive: true, force: true });
  }
  try {
    execFileSync("xcrun", ["simctl", "spawn", CONFIG.udid, "defaults", "delete", path.join(data, "Library/Preferences", BUNDLE_ID), "tentacle_query_cache_v1"], { stdio: "ignore" });
  } catch {
    // pas de cache persisté
  }
}

/**
 * L'app relancée à froid (paquet préchauffé), devant, la sonde prête, puis le
 * focus du rail sur la bibliothèque du banc (vérifié, corrigé au besoin).
 */
export async function relaunch() {
  await (await fetch(server("/index.bundle?platform=ios&dev=false&lazy=false&minify=false&app=com.tentacle.mobile&modulesOnly=false&runModule=true"))).arrayBuffer();
  execFileSync("xcrun", ["simctl", "launch", "--terminate-running-process", CONFIG.udid, BUNDLE_ID], { stdio: "ignore" });
  await sleep(2000);
  await agent(["activate"]);
  for (let i = 0; i < 30; i++) {
    if ((await cdp('typeof __libProbe === "object" && __libProbe.live.size > 5 ? "ok" : "no"')) === "ok") break;
    await sleep(1000);
  }
  await sleep(2000);
  await agent(["left", "wait:0.8"]);
  const below = new Set(["Séries", "Profil et réglages", "Banc"]);
  for (let i = 0; i < 8; i++) {
    const label = await focusedLabel();
    if (label === CONFIG.library) return true;
    await agent([below.has(label) ? "up" : "down", "wait:0.4"]);
  }
  throw new Error(`focus introuvable sur « ${CONFIG.library} »`);
}

export function save(label, data) {
  const file = path.join(OUT, `${label}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}
