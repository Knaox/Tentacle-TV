/**
 * Banc « Watch Together au bureau et sur le web depuis un profil de la Famille »
 * (lot WT du 20/10, session wt-test-bureau). Le VRAI backend du dépôt sur le
 * Jellyfin JETABLE du banc WT (`wtbench-jf`, monté par `bench:wt up`), sa base
 * SQLite à lui (`.runs/wt-bureau/`), et deux comptes JETABLES nommés comme ceux
 * de Damien — « Knaoxtest » (propriétaire de la famille) et « Knaoxtest2 »
 * (membre) — qui n'existent que sur cette instance : jamais un compte réel.
 *
 *   tsx wt-bench/bureau/up.ts up [--fresh]   # backend + famille ; garde la base sauf --fresh
 *   tsx wt-bench/bureau/up.ts down           # arrête le backend (PID noté)
 *
 * Ports : `WT_BUREAU_PORT` (3741), `WT_BUREAU_ORIGINS` (Vite 5741 + tentacle://app).
 * Les mots de passe sont ceux du banc de compat (COMPAT_PASSWORD) : rien d'imprimé.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JellyfinHttp, waitUntil } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, authenticate, ensureApiKey, ensureUser, waitForServer } from "../../../backend/test/jellyfin-compat/provision";
import { seedBackendConfig, startDatabase } from "../../../backend/test/jellyfin-compat/backendEnv";
import { coreDatabasePath } from "../../../backend/src/services/database/sqlitePath";

const REPO = resolve(__dirname, "../../../..");
const RUN_DIR = resolve(__dirname, "../../.runs/wt-bureau");
const STATE = join(RUN_DIR, "state.json");
const JF_URL = process.env.WT_JF_URL ?? "http://127.0.0.1:18830";
const PORT = Number(process.env.WT_BUREAU_PORT ?? 3741);
const BACKEND = `http://127.0.0.1:${PORT}`;
const ORIGINS = process.env.WT_BUREAU_ORIGINS ?? "http://localhost:5741,http://127.0.0.1:5741,tentacle://app";
export const OWNER = "Knaoxtest";
export const MEMBER = "Knaoxtest2";

const log = (line: string): void => console.log(`[wt-bureau] ${line}`);

interface State { pid?: number; backend: string; jellyfin: string; users: Record<string, string> }

async function api<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

function startBackend(dataDir: string): number {
  const out = openSync(join(RUN_DIR, "backend.log"), "a");
  const child = spawn(process.execPath, [require.resolve("tsx/cli"), "src/index.ts"], {
    cwd: join(REPO, "apps/backend"),
    env: {
      ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATABASE_URL: "", DB_HOST: "", TENTACLE_DATA_DIR: dataDir,
      NODE_ENV: "development", WT_DEBUG: "1", CORS_ORIGIN: ORIGINS, CORS_ORIGINS: ORIGINS,
      PAIRING_RELAY_URL: "http://127.0.0.1:9", TMDB_API_KEY: "", TENTACLE_DEV_PUSH: "",
    },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return child.pid!;
}

/** Knaoxtest propriétaire, Knaoxtest2 membre — rejouable : une famille déjà là est gardée. */
async function ensureFamily(http: JellyfinHttp, adminToken: string): Promise<void> {
  // Comme Damien l'a réglé chez lui : un compte peut fonder une famille et créer des invités.
  await api("PUT", "/api/admin/family/creation", adminToken, { createFamily: true, createGuests: true });
  const owner = await authenticate(http, OWNER, "wtbureau-setup-owner");
  const member = await authenticate(http, MEMBER, "wtbureau-setup-member");
  const listed = await api<{ profiles: Array<{ userId: string }> }>("GET", "/api/family/picker/profiles?platform=desktop", owner.token);
  if (listed.profiles.some((p) => p.userId === member.id)) {
    log("famille déjà en place");
    return;
  }
  const invitation = await api<{ id: string }>("POST", "/api/family/invitations", owner.token, { userId: member.id });
  await api("POST", "/api/family/invitations/accept", member.token, { id: invitation.id });
  log(`famille : ${OWNER} propriétaire, ${MEMBER} membre`);
}

async function up(fresh: boolean): Promise<void> {
  mkdirSync(RUN_DIR, { recursive: true });
  const http = new JellyfinHttp(JF_URL);
  await waitForServer(http, 20_000);
  const admin = await authenticate(http, ADMIN_NAME);
  const apiKey = await ensureApiKey(http, admin.token);
  const users: Record<string, string> = {};
  for (const name of [OWNER, MEMBER]) users[name] = await ensureUser(http, admin.token, name);
  const dataDir = join(RUN_DIR, "backend-data");
  if (fresh || !existsSync(coreDatabasePath(dataDir))) {
    const db = startDatabase(RUN_DIR, log);
    seedBackendConfig(db, { jellyfinUrl: JF_URL, apiKey, adminUserId: admin.id });
  }
  const pid = startBackend(dataDir);
  writeFileSync(STATE, `${JSON.stringify({ pid, backend: BACKEND, jellyfin: JF_URL, users } satisfies State, null, 2)}\n`);
  log(`backend (PID ${pid}) sur ${BACKEND} — journal ${join(RUN_DIR, "backend.log")}`);
  await waitUntil(async () => (await fetch(`${BACKEND}/api/health`).catch(() => null))?.ok === true, 120_000, "le backend répond", 1000);
  await ensureFamily(http, admin.token);
}

function down(): void {
  if (!existsSync(STATE)) return log("rien à arrêter");
  const state = JSON.parse(readFileSync(STATE, "utf8")) as State;
  try {
    if (state.pid) process.kill(-state.pid, "SIGTERM");
    log(`backend ${state.pid} arrêté`);
  } catch {
    log("backend déjà arrêté");
  }
}

// Importé (OWNER, MEMBER) par les autres essais du banc : ne rien lancer.
if (require.main === module) {
  const [command, flag] = process.argv.slice(2);
  if (command === "down") down();
  else up(flag === "--fresh").catch((err) => {
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  });
}
