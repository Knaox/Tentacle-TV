/**
 * Poser une session sur un téléphone du banc, sans geste : iPhone simulé
 * (manifeste AsyncStorage, `injectSession`) ou émulateur Android (base
 * `RKStorage` de l'app de debug, réécrite par `run-as`, app arrêtée).
 *
 *   tsx wt-bench/phones/session.ts ios <udid> <compte a|b|c|d> <nom d'appareil>
 *   tsx wt-bench/phones/session.ts android <emulator-XXXX> <compte a|b|c|d> <nom d'appareil>
 *
 * L'app Android doit avoir été lancée une fois (la base existe). Le JS vient
 * du Metro du banc : sur l'émulateur, `debug_http_host` pointe 10.0.2.2:<port>
 * (sans lui, l'app cherche 10.0.2.2:8081 — un AUTRE Metro du Mac, ou rien).
 * `adb reverse` du backend ET du Jellyfin jetable (lecture directe) : sans le
 * second, l'app se croit « session expirée » au démarrage et retombe sur
 * l'écran d'adresse. Si l'app montre malgré tout l'écran d'adresse, y saisir
 * l'adresse du backend suffit : la session posée est reprise.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, type BenchAccount, type BenchState } from "../env";
import { injectSession, launch } from "../clients/iosDevice";

const ANDROID_PACKAGE = "com.tentacletv.mobile";
const METRO_PORT = Number(process.env.WT_METRO_PORT ?? 8731);

const adb = (serial: string, ...args: string[]): string =>
  execFileSync("adb", ["-s", serial, ...args], { encoding: "utf8", timeout: 60_000 }).trim();

async function loginLikeMobile(state: BenchState, account: BenchAccount, seed: string, deviceName: string) {
  const res = await fetch(`${state.backendUrl}/api/jellyfin/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `MediaBrowser Client="Tentacle Mobile", Device="${deviceName}", DeviceId="${seed}", Version="1.0.0"`,
    },
    body: JSON.stringify({ Username: account.name, Pw: account.password }),
  });
  if (!res.ok) throw new Error(`connexion de ${account.name} refusée (${res.status})`);
  return (await res.json()) as { AccessToken: string; User: Record<string, unknown> };
}

const sqlQuote = (v: string): string => `'${v.replace(/'/g, "''")}'`;

/** Réécrit les clés de session dans `RKStorage` (pull → sqlite3 → push), app arrêtée. */
export async function injectAndroidSession(serial: string, account: BenchAccount, deviceName: string, extra: Record<string, string> = {}): Promise<string> {
  const state = readState();
  const seed = `wtbench-${deviceName.replace(/\W+/g, "-").toLowerCase()}-${account.name}`;
  const auth = await loginLikeMobile(state, account, seed, deviceName);
  adb(serial, "shell", "am", "force-stop", ANDROID_PACKAGE);
  for (const url of [state.backendUrl, state.jellyfinUrl]) {
    const port = new URL(url).port;
    adb(serial, "reverse", `tcp:${port}`, `tcp:${port}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "wtm-rk-"));
  const db = join(dir, "RKStorage");
  writeFileSync(db, execFileSync("adb", ["-s", serial, "exec-out", "run-as", ANDROID_PACKAGE, "cat", "databases/RKStorage"]));
  const values: Record<string, string> = {
    tentacle_server_url: state.backendUrl,
    tentacle_device_id: seed,
    tentacle_user: JSON.stringify(auth.User),
    tentacle_token: auth.AccessToken,
    tentacle_install_marker: "1",
    tentacle_language: "fr",
    tentacle_avatar_invite_seen: JSON.stringify([account.id]),
    ...extra,
  };
  const sql = ["DELETE FROM catalystLocalStorage WHERE key LIKE 'tentacle_%session%';"]
    .concat(Object.entries(values).map(([k, v]) => `INSERT OR REPLACE INTO catalystLocalStorage(key, value) VALUES (${sqlQuote(k)}, ${sqlQuote(v)});`))
    .join("\n");
  execFileSync("sqlite3", [db], { input: sql });
  adb(serial, "push", db, "/data/local/tmp/RKStorage.wtm");
  adb(serial, "shell", "run-as", ANDROID_PACKAGE, "rm", "-f", "databases/RKStorage-journal", "databases/RKStorage-wal", "databases/RKStorage-shm");
  adb(serial, "shell", "run-as", ANDROID_PACKAGE, "cp", "/data/local/tmp/RKStorage.wtm", "databases/RKStorage");
  // Un jeton resté dans SecureStore (session d'avant) l'emporterait sur le nôtre.
  adb(serial, "shell", "run-as", ANDROID_PACKAGE, "rm", "-f", "shared_prefs/SecureStore.xml");
  const prefs = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n    <string name="debug_http_host">10.0.2.2:${METRO_PORT}</string>\n</map>\n`;
  writeFileSync(join(dir, "prefs.xml"), prefs);
  adb(serial, "push", join(dir, "prefs.xml"), "/data/local/tmp/prefs.wtm.xml");
  adb(serial, "shell", "run-as", ANDROID_PACKAGE, "cp", "/data/local/tmp/prefs.wtm.xml", `shared_prefs/${ANDROID_PACKAGE}_preferences.xml`);
  return auth.AccessToken;
}

export function launchAndroid(serial: string): void {
  adb(serial, "shell", "monkey", "-p", ANDROID_PACKAGE, "-c", "android.intent.category.LAUNCHER", "1");
}

async function main(): Promise<void> {
  const [platform, device, key, deviceName] = process.argv.slice(2);
  const state = readState();
  const account = state.users[key as "a" | "b" | "c" | "d"];
  if (!account || !device || !deviceName) throw new Error("usage : session.ts ios|android <appareil> <a|b|c|d> <nom>");
  const extra = { tentacle_language: "fr", tentacle_avatar_invite_seen: JSON.stringify([account.id]), tentacle_video_engine: "native" };
  if (platform === "ios") {
    await injectSession(device, state, account, deviceName, extra);
    launch(device);
  } else {
    await injectAndroidSession(device, account, deviceName, extra);
    launchAndroid(device);
  }
  console.log(`[phones] ${platform} ${device} : session ${account.name} posée, app relancée`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  });
}
