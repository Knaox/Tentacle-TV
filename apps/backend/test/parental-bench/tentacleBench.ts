/**
 * Le Tentacle du banc : le VRAI backend du dépôt (tsx), sa base SQLite JETABLE
 * (dossier du passage), branché sur le Jellyfin du banc ; la clé TMDB (si on la
 * lui donne) pour que recommandations et titres extérieurs soient réels ; Vigie
 * installée depuis son dépôt (si on la lui donne), pointée sur le faux Jellyseerr.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openSqlite } from "../../src/services/database/nodeSqlite";
import { seedBackendConfig, startBackend, startDatabase, type BackendDatabase } from "../jellyfin-compat/backendEnv";
import type { BackendProcess } from "../notif-e2e/benchEnv";
import { seedTentacleHistory } from "./historySeed";
import type { JellyfinBench } from "./jellyfinBench";

export const BACKEND_PORT = Number(process.env.PARENTAL_PORT ?? 3115);

/** La clé TMDB : `PARENTAL_TMDB_KEY`, ou lue (lecture seule) dans la base nommée par `PARENTAL_TMDB_FROM`. */
export function tmdbKey(): string | null {
  if (process.env.PARENTAL_TMDB_KEY) return process.env.PARENTAL_TMDB_KEY;
  const from = process.env.PARENTAL_TMDB_FROM;
  if (!from || !existsSync(from)) return null;
  const sqlite = openSqlite(from, { readOnly: true });
  try {
    const row = sqlite.prepare(`SELECT "value" FROM "server_config" WHERE "key" = 'tmdb_api_key'`).get() as { value?: string } | undefined;
    return row?.value || null;
  } finally {
    sqlite.close();
  }
}

/** Vigie, depuis son dépôt construit (`server/index.mjs`, et `dist/` pour le hub s'il existe). */
function installVigie(dataDir: string, vigieRepo: string, seerrUrl: string): void {
  const server = join(vigieRepo, "server/index.mjs");
  if (!existsSync(server)) throw new Error(`Vigie n'est pas construite : ${server} manque (npm run build dans son dépôt)`);
  const target = join(dataDir, "plugins/seer");
  mkdirSync(join(target, "server"), { recursive: true });
  cpSync(join(vigieRepo, "plugin.json"), join(target, "plugin.json"));
  cpSync(server, join(target, "server/index.mjs"));
  if (existsSync(join(vigieRepo, "dist"))) cpSync(join(vigieRepo, "dist"), join(target, "dist"), { recursive: true });
  writeFileSync(join(dataDir, "plugins/installed.json"), JSON.stringify([{
    id: "parental-seer", pluginId: "seer", sourceId: "official", name: "Vigie", version: "banc", enabled: true,
    config: { url: seerrUrl, apiKey: "banc", enabled: true, autoApprove: true, userLimit: 0, profiles: [] },
    installedAt: new Date().toISOString(),
  }], null, 2));
}

export interface TentacleBench {
  url: string;
  db: BackendDatabase;
  backend: BackendProcess;
  tmdb: boolean;
  vigie: boolean;
}

export async function startTentacle(
  runDir: string,
  jf: JellyfinBench,
  opts: { vigieRepo?: string; seerrUrl: string },
  log: (l: string) => void,
): Promise<TentacleBench> {
  mkdirSync(runDir, { recursive: true });
  const db = startDatabase(runDir, log);
  seedBackendConfig(db, { jellyfinUrl: jf.url, apiKey: jf.apiKey, adminUserId: jf.admin.id });
  const key = tmdbKey();
  if (key) {
    const sqlite = openSqlite(db.path);
    try {
      const upsert = sqlite.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`);
      upsert.run("tmdb_api_key", key);
      upsert.run("tmdb_watch_region", "FR");
    } finally {
      sqlite.close();
    }
  }
  if (opts.vigieRepo) installVigie(db.dataDir, opts.vigieRepo, opts.seerrUrl);
  // Le passé du compte restreint, posé AVANT le démarrage : jamais à côté du Prisma du backend.
  await seedTentacleHistory(db.path, jf, jf.restricted);
  log(`Tentacle : base jetable, TMDB ${key ? "réel" : "absent (titres extérieurs non éprouvés)"}, Vigie ${opts.vigieRepo ? "installée" : "absente"}`);
  // Le banc enchaîne des milliers d'appels d'une seule adresse : le plafond global (1 000/min) le
  // couperait en 429. Les plafonds PAR ROUTE (jumelage, invités…) restent ceux de la production.
  process.env.RATE_LIMIT = process.env.RATE_LIMIT ?? "1000000";
  const backend = await startBackend({ port: BACKEND_PORT, db, runDir });
  log(`Backend du banc : http://127.0.0.1:${BACKEND_PORT} (journal ${join(runDir, "backend.log")})`);
  return { url: `http://127.0.0.1:${BACKEND_PORT}`, db, backend, tmdb: Boolean(key), vigie: Boolean(opts.vigieRepo) };
}
