/**
 * Préparer un simulateur iOS du banc, sans un seul geste à l'écran :
 * installer l'app de dev PARTAGÉE du lot, la brancher sur le Metro du banc,
 * et lui poser une session de test.
 *
 * La session : le banc se connecte par le proxy Jellyfin du backend (comme
 * l'app mobile, avec SA graine d'appareil), puis écrit, app arrêtée, le
 * manifeste AsyncStorage du conteneur (`tentacle_server_url`,
 * `tentacle_device_id`, `tentacle_user`, `tentacle_token` — ce dernier migre
 * seul vers le trousseau au lancement). Jamais `simctl openurl` : iOS
 * demande « Ouvrir dans … ? » et l'alerte ne se ferme pas sans toucher.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchAccount, BenchState } from "../env";

export const BUNDLE_ID = "com.tentacle.mobile";
export const SHARED_APP = join(process.env.HOME ?? "", ".tentacle-lot-mob/builds/ios/TentacleTV.app");

const simctl = (...args: string[]): string => execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", timeout: 240_000 }).trim();

export function bootIfNeeded(udid: string): void {
  const state = simctl("list", "devices").split("\n").find((l) => l.includes(udid)) ?? "";
  if (!state.includes("(Booted)")) simctl("boot", udid);
  simctl("bootstatus", udid, "-b");
}

export function installApp(udid: string, appPath = SHARED_APP): void {
  if (!existsSync(appPath)) throw new Error(`app iOS partagée absente : ${appPath}`);
  try {
    simctl("terminate", udid, BUNDLE_ID);
  } catch { /* pas lancée */ }
  simctl("install", udid, appPath);
}

/** Le bundle JS vient du Metro du banc (le port dit à l'app où le chercher). */
export function pointToMetro(udid: string, metroPort: number): void {
  simctl("spawn", udid, "defaults", "write", BUNDLE_ID, "RCT_jsLocation", `localhost:${metroPort}`);
}

export function launch(udid: string): void {
  simctl("launch", udid, BUNDLE_ID);
}

export function terminate(udid: string): void {
  try {
    simctl("terminate", udid, BUNDLE_ID);
  } catch { /* pas lancée */ }
}

function dataContainer(udid: string): string {
  return simctl("get_app_container", udid, BUNDLE_ID, "data");
}

/** Connexion « comme l'app » par le proxy du backend ; rend le jeton et le profil. */
async function loginLikeMobile(state: BenchState, account: BenchAccount, deviceSeed: string, deviceName: string) {
  const res = await fetch(`${state.backendUrl}/api/jellyfin/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `MediaBrowser Client="Tentacle Mobile", Device="${deviceName}", DeviceId="${deviceSeed}", Version="1.0.0"`,
    },
    body: JSON.stringify({ Username: account.name, Pw: account.password }),
  });
  if (!res.ok) throw new Error(`connexion de ${account.name} refusée (${res.status})`);
  return (await res.json()) as { AccessToken: string; User: Record<string, unknown> };
}

/**
 * Pose la session dans le manifeste AsyncStorage (app arrêtée). L'app doit
 * avoir été lancée UNE fois (le conteneur et son dossier existent).
 */
export async function injectSession(udid: string, state: BenchState, account: BenchAccount, deviceName: string, extra: Record<string, string> = {}): Promise<string> {
  const seed = `wtbench-${deviceName.replace(/\W+/g, "-").toLowerCase()}-${account.name}`;
  const auth = await loginLikeMobile(state, account, seed, deviceName);
  terminate(udid);
  const dir = join(dataContainer(udid), "Library/Application Support", BUNDLE_ID, "RCTAsyncLocalStorage_V1");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "manifest.json");
  const manifest = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string | null>) : {};
  const values: Record<string, string> = {
    tentacle_server_url: state.backendUrl,
    tentacle_device_id: seed,
    tentacle_user: JSON.stringify(auth.User),
    tentacle_token: auth.AccessToken,
    tentacle_install_marker: "1",
    ...extra,
  };
  // RCTAsyncLocalStorage : au-delà de 1 024 caractères, la valeur vit dans un
  // fichier nommé par le md5 de la clé, et le manifeste porte `null`.
  for (const [key, value] of Object.entries(values)) {
    if (value.length > 1024) {
      writeFileSync(join(dir, createHash("md5").update(key).digest("hex")), value);
      manifest[key] = null;
    } else {
      manifest[key] = value;
    }
  }
  writeFileSync(file, JSON.stringify(manifest));
  // Un jeton resté au trousseau (session d'avant) l'emporterait sur le nôtre.
  simctl("keychain", udid, "reset");
  return auth.AccessToken;
}

export function screenshot(udid: string, path: string): void {
  try {
    simctl("io", udid, "screenshot", path);
  } catch { /* simulateur occupé */ }
}
