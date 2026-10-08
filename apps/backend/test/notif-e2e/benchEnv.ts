/**
 * L'environnement du banc : un dossier de données à lui où vivent sa base
 * SQLite (recréée à chaque passage) et le VRAI plugin Vigie du dépôt, pointé
 * sur le faux Jellyseerr, et le VRAI backend lancé par tsx, dont le journal
 * est capté ligne à ligne.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, createWriteStream } from "node:fs";
import { join, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { applyCoreMigrations } from "../../src/services/database/migrator";
import { coreDatabasePath, prismaSqliteUrl } from "../../src/services/database/sqlitePath";

export const BACKEND_DIR = resolve(__dirname, "../..");
const REPO_PLUGIN_DIR = join(BACKEND_DIR, "data/plugins/seer");

/**
 * Base recréée à vide dans le dossier du banc, migrations du cœur appliquées
 * (aucune table de plugin n'existe encore). Rend l'URL du client Prisma du
 * banc — un AUTRE processus que le backend : SQLite en WAL l'accepte.
 */
export function resetDatabase(dataDir: string): string {
  const path = coreDatabasePath(dataDir);
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
  applyCoreMigrations(path);
  return prismaSqliteUrl(path);
}

/**
 * L'environnement du backend du banc : jamais la base de la machine. Une
 * `DATABASE_URL` ou des `DB_*` hérités désigneraient une MariaDB à migrer.
 */
export const NO_LEGACY_DATABASE = { DATABASE_URL: "", DB_HOST: "" } as const;

/** Le backend démarre « configuré » : setup fait, Jellyfin = le faux. */
export async function seedConfig(prisma: PrismaClient, jellyfinUrl: string, apiKey: string): Promise<void> {
  const rows = { setup_completed: "true", jellyfin_url: jellyfinUrl, jellyfin_api_key: apiKey };
  for (const [key, value] of Object.entries(rows)) {
    await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}

/** Le plugin Vigie du dépôt, installé dans le dossier du banc et pointé sur le faux Jellyseerr. */
export function prepareDataDir(dir: string, seerrUrl: string, seerrApiKey: string): void {
  if (!existsSync(join(REPO_PLUGIN_DIR, "server/index.mjs"))) {
    throw new Error(`Plugin Vigie absent de ${REPO_PLUGIN_DIR} — déployez-le d'abord (scripts/deploy-local.mjs du plugin).`);
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "plugins"), { recursive: true });
  cpSync(REPO_PLUGIN_DIR, join(dir, "plugins/seer"), { recursive: true });
  const installed = [
    {
      id: "bench-seer",
      pluginId: "seer",
      sourceId: "official",
      name: "Vigie (banc)",
      version: "bench",
      enabled: true,
      config: { url: seerrUrl, apiKey: seerrApiKey, enabled: true, autoApprove: true, userLimit: 0, profiles: [] },
      installedAt: new Date().toISOString(),
    },
  ];
  writeFileSync(join(dir, "plugins/installed.json"), JSON.stringify(installed, null, 2));
}

export interface LogLine {
  at: number;
  text: string;
}

/** Le vrai backend, lancé par tsx, journal capté (mémoire + fichier). */
export class BackendProcess {
  readonly lines: LogLine[] = [];
  private child: ChildProcess | null = null;

  constructor(readonly port: number, private readonly logFile: string) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(env: Record<string, string>): Promise<void> {
    const out = createWriteStream(this.logFile, { flags: "a" });
    // tsx résolu comme un module (pnpm le hisse à la racine du dépôt).
    this.child = spawn(process.execPath, [require.resolve("tsx/cli"), "src/index.ts"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env, PORT: String(this.port), HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pending = "";
    const onData = (chunk: Buffer): void => {
      out.write(chunk);
      pending += chunk.toString("utf8");
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      for (const text of parts) this.lines.push({ at: Date.now(), text });
    };
    this.child.stdout?.on("data", onData);
    this.child.stderr?.on("data", onData);
    this.child.on("error", (err) => this.lines.push({ at: Date.now(), text: `[banc] lancement impossible : ${err.message}` }));
    await waitFor(async () => {
      try {
        return (await fetch(`${this.url}/api/health`)).ok;
      } catch {
        return false;
      }
    }, 90_000, "le backend répond sur /api/health");
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((ok) => child.once("exit", () => ok()));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timer);
  }

  /** Les lignes du journal depuis `since` qui correspondent. */
  grep(pattern: RegExp, since = 0): LogLine[] {
    return this.lines.filter((l) => l.at >= since && pattern.test(l.text));
  }

  async waitForLog(pattern: RegExp, since: number, timeoutMs: number, what: string): Promise<LogLine> {
    let hit: LogLine | undefined;
    await waitFor(() => (hit = this.grep(pattern, since)[0]) !== undefined, timeoutMs, what);
    return hit as LogLine;
  }
}

/** Attend qu'une condition tienne ; lève avec son libellé à l'échéance. */
export async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
  what: string,
  stepMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)} s) : ${what}`);
    await sleep(stepMs);
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

export interface ApiResult<T = unknown> {
  status: number;
  json: T;
}

/** Un client de l'API comme l'app mobile : jeton Jellyfin en Bearer. */
export function apiAs(baseUrl: string, token: string) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json: json as T };
  };
  return {
    get: <T>(path: string) => call<T>("GET", path),
    post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => call<T>("PUT", path, body),
    del: <T>(path: string, body?: unknown) => call<T>("DELETE", path, body),
  };
}
