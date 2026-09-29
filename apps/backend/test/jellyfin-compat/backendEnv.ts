/**
 * Le VRAI backend Tentacle, branché sur le Jellyfin jetable : une MariaDB 11
 * à lui (conteneur Docker, jamais la base partagée de la machine), son
 * schéma posé par `prisma/core-init.sql` exactement comme l'entrypoint de
 * production, sa configuration écrite en base (`server_config`), et le
 * processus lancé par tsx sur un port à lui.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { BACKEND_DIR, BackendProcess } from "../notif-e2e/benchEnv";
import { containerState, mariaDbReady, removeContainer, startMariaDb } from "./docker";
import { waitUntil } from "./jellyfinHttp";

export interface DatabaseSpec {
  name: string;
  port: number;
}

const DB = { database: "tentacle_compat", user: "tentacle", password: "compat-mariadb-2026" };

export function databaseUrl(spec: DatabaseSpec): string {
  return `mysql://${DB.user}:${DB.password}@127.0.0.1:${spec.port}/${DB.database}`;
}

function prisma(args: string[], url: string, what: string): void {
  const res = spawnSync("npx", ["prisma", ...args], { cwd: BACKEND_DIR, env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`${what} refusé : ${res.stderr || res.stdout}`);
}

/**
 * Une base neuve à chaque passage : un état hérité fausserait les contrôles.
 * Le schéma naît comme sur une installation neuve : l'assistant de
 * configuration pousse `schema.prisma` sur la base VIDE (`routes/setup.ts`),
 * puis l'entrypoint rejoue `core-init.sql`. Ce conteneur est à la suite seule :
 * jamais une base partagée, où `db push` retirerait les tables des extensions.
 */
export async function startDatabase(spec: DatabaseSpec, log: (l: string) => void): Promise<string> {
  removeContainer(spec.name);
  log(`MariaDB 11 jetable (${spec.name}, port ${spec.port})…`);
  startMariaDb({ name: spec.name, port: spec.port, ...DB });
  await waitUntil(() => mariaDbReady(spec.name), 120_000, "MariaDB prête", 1000);
  const url = databaseUrl(spec);
  prisma(["db", "push", "--skip-generate", "--accept-data-loss"], url, "Schéma de l'assistant (db push sur base vide)");
  prisma(["db", "execute", "--schema", "prisma/schema.prisma", "--file", "prisma/core-init.sql"], url, "core-init.sql");
  return url;
}

export function stopDatabase(spec: DatabaseSpec): void {
  if (containerState(spec.name) !== "missing") removeContainer(spec.name);
}

export interface SeedInput {
  jellyfinUrl: string;
  apiKey: string;
  adminUserId: string;
}

/** Le backend démarre « installé » : Jellyfin connecté, streaming direct offert. */
export async function seedBackendConfig(dbUrl: string, input: SeedInput): Promise<string> {
  const jwtSecret = randomBytes(48).toString("hex");
  const rows: Record<string, string> = {
    setup_completed: "true",
    jellyfin_url: input.jellyfinUrl,
    jellyfin_api_key: input.apiKey,
    admin_jellyfin_id: input.adminUserId,
    jwt_secret: jwtSecret,
    direct_streaming_enabled: "true",
    jellyfin_public_url: input.jellyfinUrl,
    jellyfin_private_url: input.jellyfinUrl,
  };
  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    for (const [key, value] of Object.entries(rows)) {
      await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
  } finally {
    await prisma.$disconnect();
  }
  return jwtSecret;
}

export async function startBackend(opts: { port: number; dbUrl: string; runDir: string }): Promise<BackendProcess> {
  const dataDir = join(opts.runDir, "backend-data");
  mkdirSync(dataDir, { recursive: true });
  const backend = new BackendProcess(opts.port, join(opts.runDir, "backend.log"));
  await backend.start({
    DATABASE_URL: opts.dbUrl,
    TENTACLE_DATA_DIR: dataDir,
    NODE_ENV: "development",
    CORS_ORIGIN: "http://localhost",
    // Rien ne sort du banc : ni le relais de jumelage réel, ni TMDB, ni les push.
    PAIRING_RELAY_URL: "http://127.0.0.1:9",
    TMDB_API_KEY: "",
    TENTACLE_DEV_PUSH: "",
  });
  return backend;
}
