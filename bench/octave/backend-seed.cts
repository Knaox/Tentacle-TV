// Banc Octave : pose la base d'un backend Tentacle NEUF, installé, branché sur
// le Jellyfin jetable du banc (`octave-jellyfin`, :8196). Chaque agent a SON
// dossier de données (jamais `apps/backend/data`). N'imprime aucun secret.
//
//   cd apps/backend
//   node "$(node -p 'require.resolve("tsx/cli")')" ../../bench/octave/backend-seed.cts "$PWD" <dossier-de-données>
//
// Puis : PORT=310x TENTACLE_DATA_DIR=<dossier-de-données> pnpm dev
// (processus à part : jamais `node:sqlite` dans celui qui a Prisma ouvert).
/* eslint-disable @typescript-eslint/no-require-imports -- script de banc : charge le code du worktree visé */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [backendDir, dataDir] = process.argv.slice(2);
const stateDir = process.env.OCTAVE_STATE_DIR ?? "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state";

function readEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

function main(): void {
  if (!backendDir || !dataDir) throw new Error("usage : backend-seed.cts <apps/backend> <dossier-de-données>");
  const env = readEnv(join(stateDir, "jellyfin.env"));
  mkdirSync(dataDir, { recursive: true });
  const { applyCoreMigrations } = require(join(backendDir, "src/services/database/migrator.ts"));
  const { openSqlite } = require(join(backendDir, "src/services/database/nodeSqlite.ts"));
  const dbPath = join(dataDir, "tentacle.db");
  applyCoreMigrations(dbPath);
  const sqlite = openSqlite(dbPath);
  const existing = sqlite.prepare(`SELECT "value" FROM "server_config" WHERE "key" = 'jwt_secret'`).get() as { value: string } | undefined;
  const rows: Record<string, string> = {
    setup_completed: "true",
    jellyfin_url: env.OCTAVE_JELLYFIN_URL,
    jellyfin_api_key: env.OCTAVE_JELLYFIN_API_KEY,
    admin_jellyfin_id: env.OCTAVE_ADMIN_ID,
    admin_username: env.OCTAVE_ADMIN_NAME,
    jwt_secret: existing?.value ?? randomBytes(48).toString("hex"),
  };
  const upsert = sqlite.prepare(
    `INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
  );
  for (const [k, v] of Object.entries(rows)) upsert.run(k, v);
  sqlite.close();
  console.log(`[banc] base posée dans ${dataDir} (Jellyfin ${env.OCTAVE_JELLYFIN_URL})`);
}

main();
