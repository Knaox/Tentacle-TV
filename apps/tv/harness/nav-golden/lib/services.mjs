// Les services d'une place, lancés à la demande et GARDÉS entre deux
// commandes (un `verify` suivant repart en quelques secondes) : faux backend,
// Metro (sur le checkout servi : la référence ou le dossier courant), serveur
// et agent XCUITest d'atv-remote, démon CDP. `down` les arrête.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ATV_REMOTE_DIR, BENCH_DIR, BenchError, CACHE_DIR, capture, duration, mainCheckout, note, step } from "./config.mjs";
import { borrowedNodeModules } from "./checkout.mjs";
import { withLock } from "./checkout.mjs";
import { httpJson, isAlive, listenerOf, loadState, saveState, spawnDetached, stopProcess, waitFor } from "./processes.mjs";

const node = process.execPath;

/** Empreinte de fichiers de code du banc : un service se relance quand son code change. */
function codeHash(...dirs) {
  const hash = crypto.createHash("sha256");
  for (const dir of dirs) {
    const full = path.join(BENCH_DIR, dir);
    const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).filter((f) => /\.(m?js|cjs)$/.test(f)).sort().map((f) => path.join(full, f)) : [full];
    for (const file of files) hash.update(file).update(fs.readFileSync(file));
  }
  return hash.digest("hex").slice(0, 12);
}

/** Un service retenu dans l'état de la place, relancé s'il ne tourne plus ou ne convient plus. */
async function ensureService(ctx, name, { port, matches = () => true, start, ready, label }) {
  const state = loadState(ctx.stateFile);
  const record = state[name];
  if (isAlive(record) && matches(record) && (await ready(record))) return record;
  if (isAlive(record)) await stopProcess(record);
  const owner = port ? listenerOf(port) : null;
  if (owner) throw new BenchError(`le port ${port} (${label}) est pris par le processus ${owner}, qui n'est pas à cette place — autre session ? changer de place (--slot)`);
  const fresh = { ...start(), ...(port ? { port } : {}) };
  saveState(ctx.stateFile, { ...loadState(ctx.stateFile), [name]: fresh });
  if (!(await waitFor(() => ready(fresh), { timeoutMs: 240_000, everyMs: 700 }))) {
    throw new BenchError(`${label} ne répond pas — journal : ${fresh.log}`);
  }
  step(label, `lancé${port ? ` sur le port ${port}` : ""} — journal : ${fresh.log}`);
  return fresh;
}

export function ensureBackend(ctx, snapshot) {
  const port = ctx.ports.backend;
  return ensureService(ctx, "backend", {
    port,
    label: "Faux backend",
    matches: (r) => r.snapshot === snapshot.hash && r.cwd === BENCH_DIR && r.code === codeHash("server") && r.lan === ctx.device,
    start: () => ({
      ...spawnDetached(node, [path.join(BENCH_DIR, "server/fakeServer.mjs")], {
        cwd: BENCH_DIR, env: { PORT: String(port), SNAPSHOT_DIR: snapshot.dir, LISTEN_ALL: ctx.device ? "1" : "" }, log: path.join(ctx.logDir, "backend.log"),
      }),
      snapshot: snapshot.hash,
      code: codeHash("server"),
      lan: ctx.device,
    }),
    ready: async () => (await httpJson(`http://127.0.0.1:${port}/__peek`))?.status === 200,
  });
}

/** Metro sur le checkout servi ; relancé quand on passe de la référence au dossier courant. */
export async function ensureMetro(ctx, checkout) {
  const port = ctx.ports.metro;
  const appDir = path.join(checkout.dir, "apps/tv");
  const record = await ensureService(ctx, "metro", {
    port,
    label: `Metro (${checkout.label})`,
    matches: (r) => r.checkout === checkout.dir && r.code === codeHash("lib/metroConfig.cjs") && r.lan === ctx.device,
    start: () => ({
      ...spawnDetached(node, [path.join(mainCheckout(), "apps/tv/node_modules/react-native/cli.js"), "start", "--port", String(port), ...(ctx.device ? ["--host", "0.0.0.0"] : []), "--config", path.join(BENCH_DIR, "lib/metroConfig.cjs")], {
        cwd: appDir,
        env: { NAV_GOLDEN_CHECKOUT: checkout.dir, NAV_GOLDEN_MAIN: mainCheckout(), NAV_GOLDEN_WATCH: JSON.stringify(borrowedNodeModules(checkout.dir)) },
        log: path.join(ctx.logDir, "metro.log"),
      }),
      checkout: checkout.dir,
      code: codeHash("lib/metroConfig.cjs"),
      lan: ctx.device,
      warmed: false,
    }),
    ready: async () => {
      const res = await httpJson(`http://127.0.0.1:${port}/status`);
      return res?.text === "packager-status:running";
    },
  });
  if (!record.warmed) await warmBundle(ctx, record);
  return record;
}

export const bundleUrl = (port) => `http://127.0.0.1:${port}/index.bundle?platform=ios&dev=true&minify=false&modulesOnly=false&runModule=true&app=com.tentacle.mobile`;

/** Le premier paquet dépasse le délai de l'app sous charge : on le construit avant elle. */
async function warmBundle(ctx, record) {
  const start = Date.now();
  note("premier paquet JS en construction (jusqu'à quelques minutes sous charge)…");
  const res = await httpJson(bundleUrl(ctx.ports.metro), { timeoutMs: 600_000 });
  if (res?.status !== 200) throw new BenchError(`Metro n'a pas servi le paquet (${res?.status ?? "délai"}) — journal : ${record.log}`);
  if (!res.text.includes("nav-golden-real-app") && !res.text.includes("navProbe")) {
    throw new BenchError("le paquet ne contient pas la sonde du banc : l'enveloppe Metro n'a pas pris (apps/tv/index.js a-t-il changé ?)");
  }
  note(`paquet prêt en ${duration(Date.now() - start)} (${Math.round(res.text.length / 1e6)} Mo)`);
  const state = loadState(ctx.stateFile);
  state.metro = { ...state.metro, warmed: true };
  saveState(ctx.stateFile, state);
}

export function ensureAgentServer(ctx) {
  const { agentTcp, agentHttp } = ctx.ports;
  return ensureService(ctx, "agentServer", {
    port: agentHttp,
    label: "Serveur de l'agent",
    start: () => spawnDetached(node, [path.join(ATV_REMOTE_DIR, "server.mjs")], {
      cwd: ATV_REMOTE_DIR, env: { AGENT_TCP: String(agentTcp), AGENT_HTTP: String(agentHttp), AGENT_OUT: path.join(ctx.logDir, "shots") }, log: path.join(ctx.logDir, "agent-server.log"),
    }),
    ready: async () => (await httpJson(`http://127.0.0.1:${agentHttp}/status`))?.status === 200,
  });
}

/**
 * Le démon CDP de la place (`cdpDaemon.mjs`), qui ne suit QUE l'app relevée :
 * `target.appId` (com.tentacle.mobile au simulateur, l'app de test sur
 * l'appareil), et `target.deviceName` s'il est connu. Deux candidates : refus.
 */
export function ensureCdpd(ctx, target) {
  const { cdp, metro } = ctx.ports;
  return ensureService(ctx, "cdpd", {
    port: cdp,
    label: "Démon CDP",
    matches: (r) => r.appId === target.appId && (r.deviceName ?? null) === (target.deviceName ?? null) && r.code === codeHash("lib/cdpDaemon.mjs") && r.cwd === BENCH_DIR,
    start: () => ({
      ...spawnDetached(node, [path.join(BENCH_DIR, "lib/cdpDaemon.mjs")], {
        cwd: BENCH_DIR,
        env: { CDPD_PORT: String(cdp), METRO_PORT: String(metro), CDP_APP_ID: target.appId, CDP_DEVICE_NAME: target.deviceName ?? "", AGENT_CONSOLE: path.join(ctx.logDir, "console.log") },
        log: path.join(ctx.logDir, "cdpd.log"),
      }),
      appId: target.appId,
      deviceName: target.deviceName ?? null,
      code: codeHash("lib/cdpDaemon.mjs"),
    }),
    ready: async () => (await httpJson(`http://127.0.0.1:${cdp}/target`))?.status === 200,
  });
}

/**
 * L'agent compilé une fois par version de ses sources et de Xcode (cache de
 * la machine) : pour le simulateur sans signature, pour l'appareil signé par
 * l'équipe du compte (profil créé au premier build).
 */
export async function agentProducts({ physical = false } = {}) {
  const hash = crypto.createHash("sha256");
  for (const file of ["AgentUITests.swift", "AgentHostApp.swift", "Agent.xcodeproj/project.pbxproj"]) hash.update(fs.readFileSync(path.join(ATV_REMOTE_DIR, file)));
  hash.update(capture("xcodebuild", ["-version"]) ?? "");
  const dir = path.join(CACHE_DIR, physical ? "agent-device" : "agent", hash.digest("hex").slice(0, 12));
  const find = () => fs.existsSync(path.join(dir, "Build/Products")) && fs.readdirSync(path.join(dir, "Build/Products")).find((f) => f.endsWith(".xctestrun"));
  if (find()) return path.join(dir, "Build/Products", find());
  await withLock(`agent-${physical ? "device-" : ""}${path.basename(dir)}`, async () => {
    if (find()) return;
    step("Agent XCUITest", `compilation pour ${physical ? "l'Apple TV physique" : "le simulateur"} (une fois pour toute la machine)`);
    fs.mkdirSync(dir, { recursive: true });
    const signing = physical ? [`DEVELOPMENT_TEAM=${process.env.NAV_GOLDEN_TEAM ?? "96K3M57W49"}`, "CODE_SIGN_STYLE=Automatic", "-allowProvisioningUpdates"] : [];
    const out = capture("xcodebuild", ["-project", path.join(ATV_REMOTE_DIR, "Agent.xcodeproj"), "-scheme", "AgentUITests", "-destination", physical ? "generic/platform=tvOS" : "generic/platform=tvOS Simulator", "-derivedDataPath", dir, ...signing, "build-for-testing"], { cwd: ATV_REMOTE_DIR });
    fs.writeFileSync(path.join(dir, "build.log"), out ?? "échec");
    if (!find()) throw new BenchError(`compilation de l'agent en échec — ${path.join(dir, "build.log")}`);
  });
  return path.join(dir, "Build/Products", find());
}

/**
 * L'agent qui appuie sur les touches, connecté au serveur de la place —
 * au simulateur `device`, ou à l'Apple TV physique (`target.physical` :
 * `{ udid, host, bundle }`, l'agent y vise l'app de TEST).
 */
export async function ensureAgent(ctx, target) {
  await ensureAgentServer(ctx);
  const connected = async () => (await httpJson(`http://127.0.0.1:${ctx.ports.agentHttp}/status`))?.json?.connected === true;
  const state = loadState(ctx.stateFile);
  if (isAlive(state.agent) && state.agent.udid === target.udid && (await connected())) return state.agent;
  if (isAlive(state.agent)) await stopProcess(state.agent);
  const physical = Boolean(target.physical);
  const xctestrun = await agentProducts({ physical });
  const destination = physical ? `platform=tvOS,id=${target.udid}` : `platform=tvOS Simulator,id=${target.udid}`;
  const env = {
    TEST_RUNNER_AGENT_HOST: physical ? target.host : "127.0.0.1",
    TEST_RUNNER_AGENT_PORT: String(ctx.ports.agentTcp),
    TEST_RUNNER_AGENT_BUNDLE: target.bundle ?? "com.tentacle.mobile",
  };
  const record = {
    ...spawnDetached("xcodebuild", ["test-without-building", "-xctestrun", xctestrun, "-destination", destination], { cwd: ATV_REMOTE_DIR, env, log: path.join(ctx.logDir, "agent.log") }),
    udid: target.udid,
  };
  saveState(ctx.stateFile, { ...loadState(ctx.stateFile), agent: record });
  if (!(await waitFor(connected, { timeoutMs: 300_000, everyMs: 1000 }))) throw new BenchError(`l'agent XCUITest ne s'est pas connecté — journal : ${record.log}`);
  step("Agent XCUITest", `connecté (${physical ? "Apple TV physique" : `simulateur ${target.name}`})`);
  return record;
}

/** Arrête tout ce que la place a lancé (par PID). */
export async function stopAll(ctx) {
  const state = loadState(ctx.stateFile);
  const stopped = [];
  // L'agent finit proprement son test (« quit ») avant qu'on arrête son xcodebuild.
  if (isAlive(state.agent)) await httpJson(`http://127.0.0.1:${ctx.ports.agentHttp}/run`, { method: "POST", body: ["quit"], timeoutMs: 10_000 });
  for (const name of ["agent", "agentServer", "cdpd", "metro", "backend"]) {
    if (await stopProcess(state[name])) stopped.push(name);
    delete state[name];
  }
  saveState(ctx.stateFile, state);
  return stopped;
}
