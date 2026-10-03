// Mettre la place en état de rejouer : données figées, code servi (référence
// ou dossier courant), app native installée sur un simulateur EFFACÉ au
// premier usage, services de fond ; puis, avant chaque scénario, un
// démarrage À FROID sur un état de l'app remis à zéro.
import { execFileSync } from "node:child_process";
import { BUNDLE_ID, BenchError, capture, note, sleep, step } from "./config.mjs";
import { ambiguityMessage } from "./cdpTarget.mjs";
import { currentCheckout, referenceCheckout } from "./checkout.mjs";
import { ensureNativeApp } from "./nativeApp.mjs";
import { httpJson, loadState, saveState, waitFor } from "./processes.mjs";
import { agentRun, tryEvaluate } from "./remote.mjs";
import { ensureAgent, ensureBackend, ensureCdpd, ensureMetro } from "./services.mjs";
import { describeDevice, ensureInstalled, ensureSimulator, findDevice, launchApp, resetAppState } from "./simulator.mjs";
import { frozenSnapshot } from "./snapshot.mjs";
import { settle } from "./observe.mjs";
import { TEST_BUNDLE, checkUserApp, describePhysical, deviceIds, ensureDeviceApp, ensureDeviceInstalled, launchOnDevice, macIp } from "./device.mjs";

/**
 * Un simulateur pris pour la première fois par cette place est EFFACÉ : un
 * clone peut porter une vraie session et le cache d'un vrai serveur (alerte
 * du 2026-10-03), que `simctl install` garderait.
 */
function eraseOnce(ctx, device, { erase }) {
  const state = loadState(ctx.stateFile);
  if (device.created) {
    // Créé neuf à l'instant : rien à effacer.
    saveState(ctx.stateFile, { ...state, erased: { ...state.erased, [device.udid]: new Date().toISOString() } });
    return device;
  }
  if (state.erased?.[device.udid] || !erase) return device;
  step("Simulateur", `« ${device.name} » effacé avant son premier usage par le banc (simctl erase)`);
  capture("xcrun", ["simctl", "shutdown", device.udid]);
  execFileSync("xcrun", ["simctl", "erase", device.udid]);
  execFileSync("xcrun", ["simctl", "bootstatus", device.udid, "-b"]);
  saveState(ctx.stateFile, { ...loadState(ctx.stateFile), erased: { ...state.erased, [device.udid]: new Date().toISOString() }, installed: {}, agent: null });
  return findDevice(device.udid);
}

/** Tout ce qu'il faut pour rejouer sur `at` (une révision) ou le dossier courant. */
export async function prepare(ctx, { at = null, erase = true } = {}) {
  const snapshot = await frozenSnapshot();
  const checkout = at ? await referenceCheckout(at) : currentCheckout();
  step("Code servi", checkout.label);
  if (ctx.device) return preparePhysical(ctx, checkout, snapshot);
  const { fingerprint, app } = await ensureNativeApp(checkout);
  let device = ensureSimulator(ctx.sim);
  device = eraseOnce(ctx, device, { erase });
  const state = loadState(ctx.stateFile);
  if (ensureInstalled(device, app, fingerprint, state)) saveState(ctx.stateFile, { ...loadState(ctx.stateFile), installed: state.installed });
  await ensureBackend(ctx, snapshot);
  await ensureMetro(ctx, checkout);
  // L'app du simulateur DE LA PLACE (RN-tvOS y donne le nom du simulateur à l'inspecteur).
  await ensureCdpd(ctx, { appId: BUNDLE_ID, deviceName: device.name });
  await ensureAgent(ctx, device);
  return { checkout, snapshot, device, agentTarget: device, fingerprint, deviceInfo: describeDevice(device) };
}

/**
 * L'Apple TV physique : l'app de TEST installée à côté de celle de
 * l'utilisateur (vérifiée présente avant), Metro et faux backend sur l'IP du
 * Mac, l'agent sur l'appareil.
 */
async function preparePhysical(ctx, checkout, snapshot) {
  const { udid } = deviceIds();
  checkUserApp("avant le passage");
  const { fingerprint, app } = await ensureDeviceApp(checkout);
  const state = loadState(ctx.stateFile);
  if (ensureDeviceInstalled(app, fingerprint, state)) saveState(ctx.stateFile, { ...loadState(ctx.stateFile), installedDevice: state.installedDevice });
  await ensureBackend(ctx, snapshot);
  await ensureMetro(ctx, checkout);
  // L'app de TEST seulement : l'app du simulateur de la place, reconnectée au même
  // Metro, n'est jamais prise pour elle (passage de T5, 2026-10-03).
  await ensureCdpd(ctx, { appId: TEST_BUNDLE });
  const agentTarget = { udid, physical: true, host: macIp(), bundle: TEST_BUNDLE };
  await ensureAgent(ctx, agentTarget);
  return { checkout, snapshot, device: { udid, physical: true }, agentTarget, fingerprint, deviceInfo: describePhysical() };
}

/**
 * Attend que le démon CDP tienne UNE cible, celle de l'app relevée. Deux
 * candidates plus de 10 s d'affilée (pas le reste d'une app qu'on vient de
 * relancer) : refus explicite — rien n'est fermé d'office.
 */
async function awaitSingleTarget(ctx) {
  let ambiguousSince = null;
  const found = await waitFor(async () => {
    const target = (await httpJson(`http://127.0.0.1:${ctx.ports.cdp}/target`))?.json;
    if (target?.state === "ambiguous") {
      ambiguousSince ??= Date.now();
      if (Date.now() - ambiguousSince > 10_000) throw new BenchError(ambiguityMessage(target, { appId: target.appId, metroPort: ctx.ports.metro }));
      return null;
    }
    ambiguousSince = null;
    return target?.state === "ready" && target.connected ? target : null;
  }, { timeoutMs: 180_000, everyMs: 500 });
  if (!found) throw new BenchError(`l'app n'est jamais apparue dans l'inspecteur du Metro ${ctx.ports.metro} (cible attendue : voir GET localhost:${ctx.ports.cdp}/target)`);
  return found;
}

/** Remet le faux backend à la base + les jeux du scénario. */
export async function applyFixtures(ctx, sets = []) {
  const res = await httpJson(`http://127.0.0.1:${ctx.ports.backend}/__fixtures`, { method: "POST", body: { sets } });
  if (res?.json?.ok !== true) throw new BenchError(`jeux de données refusés : ${res?.json?.error ?? res?.text ?? "faux backend muet"}`);
  return res.json.applied;
}

/**
 * Démarrage à froid : app arrêtée, état remis à zéro, session du banc posée,
 * lancée, ramenée devant ; attend la sonde, la navigation prête et un focus
 * stable. Rend le relevé d'entrée.
 */
export async function coldStart(ctx, session, start = {}) {
  // L'agent mort entre deux scénarios (un test XCUITest fini sur une exception) :
  // relancé UNE fois ici, avant de conclure « agent absent ».
  await ensureAgent(ctx, session.agentTarget, { relaunchNote: true });
  await applyFixtures(ctx, start.fixtures ?? []);
  if (session.device.physical) {
    // L'app de TEST relancée ; la sonde remet son état à zéro sur ses arguments.
    launchOnDevice(ctx, { session: start.session ?? "paired", storage: start.storage ?? {} });
  } else {
    resetAppState(session.device, {
      metroPort: ctx.ports.metro, backendPort: ctx.ports.backend, session: start.session ?? "paired", storage: start.storage,
    });
    await launchApp(session.device, ctx.ports.metro);
  }
  await agentRun(ctx, ["activate"]);
  await awaitSingleTarget(ctx);
  const loaded = await waitFor(() => tryEvaluate(ctx, "globalThis.__navGolden ? globalThis.__navGolden.version : 0"), { timeoutMs: 180_000, everyMs: 500 });
  if (!loaded) throw new BenchError("la sonde du banc n'a pas paru dans l'app (paquet servi ? écran rouge ? voir le journal de Metro et console.log de la place)");
  // L'app passe parfois derrière l'accueil de tvOS (autres sessions, lanceur de tests) : on la ramène.
  await agentRun(ctx, ["activate"]);
  const ready = await waitFor(async () => (await tryEvaluate(ctx, "globalThis.__navGolden.observe().route")) ?? null, { timeoutMs: 90_000, everyMs: 400 });
  if (!ready) throw new BenchError("la navigation de l'app n'est jamais prête");
  await sleep(300);
  let entry = await settle(ctx, { since: 0, minMs: 1500, quietMs: 1500, timeoutMs: 60_000, nullQuietMs: 10_000 });
  // Repassée derrière l'accueil de tvOS au démarrage (une autre session qui rouvre
  // Simulator.app) : on la ramène, deux fois au plus — ce n'est pas l'app qui a décidé.
  for (let i = 0; i < 2 && entry.app === "background"; i++) {
    await agentRun(ctx, ["activate"]);
    entry = await settle(ctx, { since: 0, minMs: 1000, quietMs: 1500, timeoutMs: 30_000 });
  }
  return entry;
}

export function sessionSummary(session) {
  note(`données ${session.snapshot.hash} · natif ${session.fingerprint} · ${session.deviceInfo.name} (${session.deviceInfo.model}, ${session.deviceInfo.runtime})`);
}
