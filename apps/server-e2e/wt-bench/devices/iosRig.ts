/**
 * Le gréement iOS du banc : le Metro du worktree (port à lui), les deux
 * simulateurs du banc (« WT banc iPhone/iPad (Claude) », jamais le simulateur
 * de base), l'app partagée installée, une session posée sur chacun, puis la
 * connexion Hermes. Les PID et identifiants sont notés dans `.runs/wt/`.
 */

import { spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, RUN_DIR, readState, type BenchAccount } from "../env";
import { bootIfNeeded, injectSession, installApp, launch, pointToMetro, terminate } from "../clients/iosDevice";
import { IosClient } from "../clients/iosClient";
import { listTargets } from "../clients/hermes";

export const METRO_PORT = Number(process.env.WT_METRO_PORT ?? 8095);
const SIMS_FILE = join(RUN_DIR, "sims.json");
const METRO_PID = join(RUN_DIR, "metro.pid");

export interface Sims {
  iphone: string;
  ipad: string;
}

export function readSims(): Sims {
  return JSON.parse(readFileSync(SIMS_FILE, "utf8")) as Sims;
}

/** Metro du worktree, détaché ; réutilisé s'il répond déjà. */
export async function ensureMetro(): Promise<void> {
  try {
    if ((await fetch(`http://127.0.0.1:${METRO_PORT}/status`)).ok) return;
  } catch { /* pas lancé */ }
  const out = openSync(join(RUN_DIR, "metro.log"), "a");
  const child = spawn("npx", ["expo", "start", "--port", String(METRO_PORT)], {
    cwd: join(REPO, "apps/mobile"), env: { ...process.env, CI: "1" }, detached: true, stdio: ["ignore", out, out],
  });
  child.unref();
  writeFileSync(METRO_PID, String(child.pid));
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${METRO_PORT}/status`)).ok) return;
    } catch { /* pas encore */ }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error("Metro ne répond pas en 3 min");
}

export function stopMetro(): void {
  if (!existsSync(METRO_PID)) return;
  const pid = Number(readFileSync(METRO_PID, "utf8"));
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch { /* déjà parti */ }
  }
}

/**
 * Un simulateur prêt : app installée, branchée sur le Metro, session de ce
 * compte posée, app lancée, cible Hermes connectée.
 */
/** Un appareil déjà installé : session reposée (même jeton neuf), app relancée, Hermes rebranché. */
export async function relaunchIosMember(udid: string, account: BenchAccount, label: string, deviceName: string): Promise<IosClient> {
  const state = readState();
  bootIfNeeded(udid);
  terminate(udid);
  const token = await injectSession(udid, state, account, deviceName, {
    tentacle_language: "fr",
    tentacle_avatar_invite_seen: JSON.stringify([account.id]),
  });
  launch(udid);
  await waitForTarget(deviceName);
  return IosClient.attach(state, account, label, METRO_PORT, deviceName, token);
}

async function waitForTarget(deviceName: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const targets = await listTargets(METRO_PORT).catch(() => []);
    if (targets.some((t) => (t.deviceName ?? t.title).includes(deviceName) && !(t.description ?? "").includes("Reanimated"))) return;
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}

export async function prepareIosMember(udid: string, account: BenchAccount, label: string, deviceName: string): Promise<IosClient> {
  const state = readState();
  bootIfNeeded(udid);
  installApp(udid);
  pointToMetro(udid, METRO_PORT);
  // Premier lancement : le conteneur de données naît ; puis la session, puis le vrai lancement.
  launch(udid);
  await new Promise((ok) => setTimeout(ok, 4000));
  terminate(udid);
  // L'interface en français (les libellés que vérifient les scénarios) et l'invitation
  // « Choisis ton personnage » déjà vue : elle recouvrirait l'accueil.
  const token = await injectSession(udid, state, account, deviceName, {
    tentacle_language: "fr",
    tentacle_avatar_invite_seen: JSON.stringify([account.id]),
  });
  launch(udid);
  await waitForTarget(deviceName);
  return IosClient.attach(state, account, label, METRO_PORT, deviceName, token);
}
