/**
 * Ce que partagent les bancs « Watch Together depuis un profil » : un backend
 * du dépôt à eux (base jetable, arrêté à la fin par son PID), sur le Jellyfin
 * jetable du banc Watch Together (`wtbench-jf`, monté par `bench:wt up`), le
 * relevé des vérifications et son rapport. Jamais lancé par `pnpm test`.
 */

import { spawn } from "node:child_process";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JellyfinHttp, waitUntil } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, authenticate, ensureApiKey, ensureUser, waitForServer, type Account } from "../../../backend/test/jellyfin-compat/provision";
import { seedBackendConfig, startDatabase } from "../../../backend/test/jellyfin-compat/backendEnv";

const REPO = resolve(__dirname, "../../../..");
const JF_URL = process.env.WT_JF_URL ?? "http://127.0.0.1:18830";

export interface Bench {
  log: (line: string) => void;
  check: (step: string, ok: boolean, detail: unknown) => void;
}

export interface BenchContext {
  http: JellyfinHttp;
  admin: Account;
  backend: string;
}

function startBackend(runDir: string, dataDir: string, port: number): number {
  const out = openSync(join(runDir, "backend.log"), "a");
  const child = spawn(process.execPath, [require.resolve("tsx/cli"), "src/index.ts"], {
    cwd: join(REPO, "apps/backend"),
    env: {
      ...process.env, PORT: String(port), HOST: "127.0.0.1", DATABASE_URL: "", DB_HOST: "", TENTACLE_DATA_DIR: dataDir,
      NODE_ENV: "development", WT_DEBUG: "1", PAIRING_RELAY_URL: "http://127.0.0.1:9", TMDB_API_KEY: "", TENTACLE_DEV_PUSH: "",
    },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return child.pid!;
}

/** Monte le Jellyfin jetable et un backend à lui, joue le scénario, écrit le rapport, dit le verdict. */
export async function runBench(
  name: string,
  options: { port: number; users: string[] },
  scenario: (bench: Bench, context: BenchContext) => Promise<void>,
): Promise<void> {
  const runDir = resolve(__dirname, `../../.runs/${name}`);
  const log = (line: string): void => console.log(`[${name}] ${line}`);
  const checks: Array<{ step: string; ok: boolean; detail: string }> = [];
  const check = (step: string, ok: boolean, detail: unknown): void => {
    checks.push({ step, ok, detail: JSON.stringify(detail) });
    log(`${ok ? "✔" : "✘"} ${step} — ${JSON.stringify(detail)}`);
  };

  mkdirSync(runDir, { recursive: true });
  const http = new JellyfinHttp(JF_URL);
  await waitForServer(http, 20_000);
  const admin = await authenticate(http, ADMIN_NAME);
  const apiKey = await ensureApiKey(http, admin.token);
  for (const user of options.users) await ensureUser(http, admin.token, user);
  const db = startDatabase(runDir, log);
  seedBackendConfig(db, { jellyfinUrl: JF_URL, apiKey, adminUserId: admin.id });
  const pid = startBackend(runDir, db.dataDir, options.port);
  const backend = `http://127.0.0.1:${options.port}`;
  log(`backend (PID ${pid}) sur ${backend}`);
  try {
    await waitUntil(async () => (await fetch(`${backend}/api/health`).catch(() => null))?.ok === true, 120_000, "le backend répond", 1000);
    await scenario({ log, check }, { http, admin, backend });
  } finally {
    try {
      process.kill(-pid, "SIGTERM");
    } catch { /* déjà arrêté */ }
  }
  writeFileSync(join(runDir, "report.json"), `${JSON.stringify(checks, null, 2)}\n`);
  const failed = checks.filter((c) => !c.ok).length;
  log(`${checks.length - failed} ✔ / ${failed} ✘ — rapport : ${join(runDir, "report.json")}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

/** Un appel REST au backend, porté par `token` (Bearer), avec le `fetch` de l'appareil. */
export function restClient(backend: string, doFetch: typeof fetch = fetch) {
  return async function api<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${backend}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  };
}
