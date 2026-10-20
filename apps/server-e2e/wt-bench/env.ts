/**
 * L'environnement du banc Watch Together, monté une fois (`up`) puis rejoué
 * scénario par scénario : un Jellyfin OFFICIEL jetable (sa médiathèque
 * synthétique, deux comptes jetables), le VRAI backend du dépôt sur sa base
 * SQLite à lui, le client web servi par Vite. Chaque service a son port et son
 * PID notés dans `.runs/wt/state.json` : `down` n'arrête que les siens.
 *
 * Comptes : `compat-user` et `compat-user2` de l'instance jetable — jamais un
 * compte réel (les comptes Knaoxtest vivent sur le Jellyfin de Damien, que le
 * banc ne touche pas).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertDockerReady, containerState, docker, ensureImage, removeContainer, removeVolume, runInJellyfinImage, startJellyfin,
} from "../../backend/test/jellyfin-compat/docker";
import { JellyfinHttp, waitUntil } from "../../backend/test/jellyfin-compat/jellyfinHttp";
import {
  ADMIN_NAME, COMPAT_PASSWORD, USER2_NAME, USER_NAME, allowShortResume, authenticate, completeWizard, ensureApiKey, ensureUser, waitForServer,
} from "../../backend/test/jellyfin-compat/provision";
import { runTask } from "../../backend/test/jellyfin-compat/fixtures";
import { seedBackendConfig, startDatabase } from "../../backend/test/jellyfin-compat/backendEnv";
import { EPISODES, mediaScript } from "./media";

export const REPO = resolve(__dirname, "../../..");
export const RUN_DIR = resolve(__dirname, "../.runs/wt");
const STATE_FILE = join(RUN_DIR, "state.json");

export const PREFIX = "wtbench";
export const JELLYFIN_IMAGE = process.env.WT_JELLYFIN_IMAGE ?? "jellyfin/jellyfin:10.11";
export const PORTS = {
  jellyfin: Number(process.env.WT_JF_PORT ?? 18830),
  backend: Number(process.env.WT_BACKEND_PORT ?? 3830),
  web: Number(process.env.WT_WEB_PORT ?? 5830),
};

const USER3_NAME = "wtbench-user3";
const USER4_NAME = "wtbench-user4";

export interface BenchAccount {
  name: string;
  password: string;
  id: string;
}

export interface BenchState {
  jellyfinUrl: string;
  backendUrl: string;
  webUrl: string;
  /** a, b : la paire de toujours ; c, d : un troisième membre et un groupe voisin. */
  users: { a: BenchAccount; b: BenchAccount; c?: BenchAccount; d?: BenchAccount };
  seriesId: string;
  episodeIds: string[];
  pids: { backend?: number; web?: number };
}

export function readState(): BenchState {
  if (!existsSync(STATE_FILE)) throw new Error("Banc non monté : lancer `pnpm --filter @tentacle-tv/server-e2e bench:wt up` d'abord.");
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as BenchState;
}

function writeState(state: BenchState): void {
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

const log = (line: string): void => console.log(`[wt-bench] ${line}`);

/** Jellyfin jetable : médiathèque, assistant, clé d'API, comptes, scan. */
async function upJellyfin(): Promise<Omit<BenchState, "backendUrl" | "webUrl" | "pids"> & { apiKey: string; adminId: string }> {
  assertDockerReady();
  ensureImage(JELLYFIN_IMAGE, log);
  const media = `${PREFIX}-media`;
  docker(["volume", "create", "--label", "tentacle.wt-bench=1", media]);
  log("Médiathèque synthétique…");
  log(`  ${runInJellyfinImage(JELLYFIN_IMAGE, media, mediaScript()).stdout.trim().split("\n").pop()}`);

  const container = `${PREFIX}-jf`;
  if (containerState(container) === "stopped") docker(["start", container]);
  if (containerState(container) === "missing") {
    log(`Démarrage de ${JELLYFIN_IMAGE} (${container}, port ${PORTS.jellyfin})…`);
    startJellyfin({
      name: container, image: JELLYFIN_IMAGE, port: PORTS.jellyfin,
      configVolume: `${container}-config`, cacheVolume: `${container}-cache`, mediaVolume: media,
    });
  }
  const url = `http://127.0.0.1:${PORTS.jellyfin}`;
  const http = new JellyfinHttp(url);
  const info = await waitForServer(http);
  log(`Jellyfin ${info.Version} répond.`);
  await completeWizard(http);
  const admin = await authenticate(http, ADMIN_NAME);
  const apiKey = await ensureApiKey(http, admin.token);
  await allowShortResume(http, admin.token);
  await ensureShowsLibrary(http, admin.token);
  const userA = await ensureUser(http, admin.token, USER_NAME);
  const userB = await ensureUser(http, admin.token, USER2_NAME);
  const userC = await ensureUser(http, admin.token, USER3_NAME);
  const userD = await ensureUser(http, admin.token, USER4_NAME);
  const { seriesId, episodeIds } = await scanShow(http, admin.token, admin.id);
  await ensureTmdbId(http, admin.token, admin.id, seriesId);
  return {
    jellyfinUrl: url, apiKey, adminId: admin.id, seriesId, episodeIds,
    users: {
      a: { name: USER_NAME, password: COMPAT_PASSWORD, id: userA },
      b: { name: USER2_NAME, password: COMPAT_PASSWORD, id: userB },
      c: { name: USER3_NAME, password: COMPAT_PASSWORD, id: userC },
      d: { name: USER4_NAME, password: COMPAT_PASSWORD, id: userD },
    },
  };
}

/** Une seule bibliothèque, sans fournisseurs Internet : le banc ne sort pas. */
async function ensureShowsLibrary(http: JellyfinHttp, token: string): Promise<void> {
  const folders = await http.get<Array<{ Name: string }>>("/Library/VirtualFolders", token);
  if (folders.some((f) => f.Name === "Séries")) return;
  const params = new URLSearchParams({ name: "Séries", paths: "/media/shows", refreshLibrary: "false", collectionType: "tvshows" });
  await http.request(`/Library/VirtualFolders?${params}`, {
    method: "POST", token,
    body: { LibraryOptions: { Enabled: true, EnableRealtimeMonitor: false, EnableInternetProviders: false, EnableTrickplayImageExtraction: false, AutomaticRefreshIntervalDays: 0 } },
  });
}

async function scanShow(http: JellyfinHttp, token: string, adminId: string): Promise<{ seriesId: string; episodeIds: string[] }> {
  type Items = { Items: Array<{ Id: string; IndexNumber?: number }> };
  const episodes = (): Promise<Items> => http.get<Items>(`/Items?userId=${adminId}&Recursive=true&IncludeItemTypes=Episode&SortBy=IndexNumber`, token);
  if ((await episodes()).Items.length < EPISODES.length) {
    log("Scan de la médiathèque…");
    await runTask(http, token, ["RefreshLibrary"], 600_000);
    await waitUntil(async () => (await episodes()).Items.length >= EPISODES.length, 180_000, "épisodes indexés", 2000);
  }
  const series = await http.get<Items>(`/Items?userId=${adminId}&Recursive=true&IncludeItemTypes=Series`, token);
  const eps = (await episodes()).Items.sort((x, y) => (x.IndexNumber ?? 0) - (y.IndexNumber ?? 0));
  return { seriesId: series.Items[0].Id, episodeIds: eps.map((e) => e.Id) };
}

/**
 * L'affinité (et la reco) ne retiennent que les titres qui ont un identifiant
 * TMDB. La série synthétique n'en a pas (fournisseurs coupés) : on lui en
 * pose un, fictif — le banc ne parle jamais à TMDB.
 */
async function ensureTmdbId(http: JellyfinHttp, token: string, adminId: string, itemId: string): Promise<void> {
  const item = await http.get<Record<string, unknown> & { ProviderIds?: Record<string, string> }>(`/Items/${itemId}?userId=${adminId}`, token);
  if (item.ProviderIds?.Tmdb) return;
  await http.post(`/Items/${itemId}`, { ...item, ProviderIds: { ...(item.ProviderIds ?? {}), Tmdb: "990001" } }, token);
}

/** Lance un processus détaché, journal dans un fichier ; rend son PID. */
function detached(cmd: string, args: string[], cwd: string, env: Record<string, string>, logName: string): number {
  const out = openSync(join(RUN_DIR, logName), "a");
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", out, out] });
  child.unref();
  return child.pid!;
}

async function waitHttp(url: string, what: string, timeoutMs = 120_000): Promise<void> {
  await waitUntil(async () => {
    try {
      return (await fetch(url)).status < 500;
    } catch {
      return false;
    }
  }, timeoutMs, what, 1000);
}

export async function up(): Promise<BenchState> {
  mkdirSync(RUN_DIR, { recursive: true });
  const prev = existsSync(STATE_FILE) ? readState() : null;
  if (prev) stopProcesses(prev);
  const jf = await upJellyfin();

  const db = startDatabase(RUN_DIR, log);
  seedBackendConfig(db, { jellyfinUrl: jf.jellyfinUrl, apiKey: jf.apiKey, adminUserId: jf.adminId });
  const backendUrl = `http://127.0.0.1:${PORTS.backend}`;
  const backendPid = detached(process.execPath, [require.resolve("tsx/cli"), "src/index.ts"], join(REPO, "apps/backend"), {
    PORT: String(PORTS.backend), HOST: "127.0.0.1", DATABASE_URL: "", DB_HOST: "",
    TENTACLE_DATA_DIR: db.dataDir, NODE_ENV: "development", WT_DEBUG: "1",
    PAIRING_RELAY_URL: "http://127.0.0.1:9", TMDB_API_KEY: "", TENTACLE_DEV_PUSH: "",
  }, "backend.log");
  log(`Backend (PID ${backendPid}) sur ${backendUrl}…`);
  await waitHttp(`${backendUrl}/api/health`, "le backend répond");

  const webUrl = `http://127.0.0.1:${PORTS.web}`;
  const webPid = detached(process.execPath, [join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(PORTS.web), "--strictPort", "--host", "127.0.0.1"],
    join(REPO, "apps/web"), { TENTACLE_DEV_API: backendUrl, NODE_OPTIONS: "--max-old-space-size=4096" }, "web.log");
  log(`Vite (PID ${webPid}) sur ${webUrl}…`);
  await waitHttp(webUrl, "Vite répond");

  const state: BenchState = {
    jellyfinUrl: jf.jellyfinUrl, backendUrl, webUrl, users: jf.users, seriesId: jf.seriesId, episodeIds: jf.episodeIds,
    pids: { backend: backendPid, web: webPid },
  };
  writeState(state);
  log(`Prêt : ${JSON.stringify({ webUrl, backendUrl, episodes: jf.episodeIds.length })}`);
  return state;
}

/** Arrête les processus du banc par leur PID (jamais `pkill -f`). */
function stopProcesses(state: BenchState): void {
  for (const pid of [state.pids.backend, state.pids.web]) {
    if (!pid) continue;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch { /* déjà parti */ }
    }
  }
}

/** Relance le seul backend (après une fusion de branche à éprouver). */
export async function restartBackend(): Promise<void> {
  const state = readState();
  if (state.pids.backend) {
    try {
      process.kill(-state.pids.backend, "SIGTERM");
    } catch { /* déjà parti */ }
  }
  await new Promise((ok) => setTimeout(ok, 1500));
  const dataDir = join(RUN_DIR, "backend-data");
  state.pids.backend = detached(process.execPath, [require.resolve("tsx/cli"), "src/index.ts"], join(REPO, "apps/backend"), {
    PORT: String(PORTS.backend), HOST: "127.0.0.1", DATABASE_URL: "", DB_HOST: "",
    TENTACLE_DATA_DIR: dataDir, NODE_ENV: "development", WT_DEBUG: "1",
    PAIRING_RELAY_URL: "http://127.0.0.1:9", TMDB_API_KEY: "", TENTACLE_DEV_PUSH: "",
  }, "backend.log");
  await waitHttp(`${state.backendUrl}/api/health`, "le backend répond");
  writeState(state);
}

export function down(opts: { purge: boolean }): void {
  if (existsSync(STATE_FILE)) stopProcesses(readState());
  if (opts.purge) {
    removeContainer(`${PREFIX}-jf`);
    removeVolume(`${PREFIX}-jf-config`);
    removeVolume(`${PREFIX}-jf-cache`);
    removeVolume(`${PREFIX}-media`);
  } else if (containerState(`${PREFIX}-jf`) === "running") {
    docker(["stop", `${PREFIX}-jf`]);
  }
  log(opts.purge ? "Banc démonté (conteneur et volumes supprimés)." : "Banc arrêté (conteneur gardé).");
}
