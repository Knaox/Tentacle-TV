/**
 * Le VRAI backend Tentacle, branché sur le Jellyfin jetable : sa base SQLite à
 * lui (un dossier du passage, jamais la base de la machine), posée par les
 * migrations du cœur exactement comme au démarrage du serveur, sa
 * configuration écrite en base (`server_config`), et le processus lancé par
 * tsx sur un port à lui.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyCoreMigrations } from "../../src/services/database/migrator";
import { openSqlite } from "../../src/services/database/nodeSqlite";
import { coreDatabasePath, prismaSqliteUrl } from "../../src/services/database/sqlitePath";
import { BackendProcess, NO_LEGACY_DATABASE } from "../notif-e2e/benchEnv";

export interface BackendDatabase {
  /** Le dossier de données du backend (`TENTACLE_DATA_DIR`). */
  dataDir: string;
  /** Le fichier SQLite. */
  path: string;
  /** L'URL qu'un client Prisma des suites ouvre — un AUTRE processus que le backend. */
  url: string;
}

/** Une base neuve à chaque passage : un état hérité fausserait les contrôles. */
export function startDatabase(runDir: string, log: (l: string) => void): BackendDatabase {
  const dataDir = join(runDir, "backend-data");
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  const path = coreDatabasePath(dataDir);
  log(`Base SQLite jetable (${path})…`);
  applyCoreMigrations(path);
  return { dataDir, path, url: prismaSqliteUrl(path) };
}

export interface SeedInput {
  jellyfinUrl: string;
  apiKey: string;
  adminUserId: string;
}

/** Le backend démarre « installé » : Jellyfin connecté, streaming direct offert. Avant son démarrage. */
export function seedBackendConfig(db: BackendDatabase, input: SeedInput): string {
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
  const sqlite = openSqlite(db.path);
  try {
    const upsert = sqlite.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`);
    for (const [key, value] of Object.entries(rows)) upsert.run(key, value);
  } finally {
    sqlite.close();
  }
  return jwtSecret;
}

export async function startBackend(opts: { port: number; db: BackendDatabase; runDir: string }): Promise<BackendProcess> {
  const backend = new BackendProcess(opts.port, join(opts.runDir, "backend.log"));
  await backend.start({
    ...NO_LEGACY_DATABASE,
    TENTACLE_DATA_DIR: opts.db.dataDir,
    NODE_ENV: "development",
    CORS_ORIGIN: "http://localhost",
    // Rien ne sort du banc : ni le relais de jumelage réel, ni TMDB, ni les push.
    PAIRING_RELAY_URL: "http://127.0.0.1:9",
    TMDB_API_KEY: "",
    TENTACLE_DEV_PUSH: "",
  });
  return backend;
}
