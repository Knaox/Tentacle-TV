// Banc Liquid Glass : pose la base d'un backend neuf, installé, branché sur le
// Jellyfin jetable `lg-banc-jf` (cf. README). N'imprime aucun secret.
//   node <tsx/cli> seed.cts <apps/backend> <dossier de données> <dossier d'état jf>
/* eslint-disable @typescript-eslint/no-require-imports -- script de banc : charge le code du worktree visé */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const [backendDir, dataDir, jfDir] = process.argv.slice(2) as [string, string, string];
const JF = "http://127.0.0.1:18307";
const apiKey = readFileSync(join(jfDir, "api-key"), "utf8").trim();
async function main() {
  const dbPath = join(dataDir, "tentacle.db");
  if (existsSync(dbPath)) {
    console.log("[banc] base déjà posée");
    return;
  }
  const users = (await (await fetch(`${JF}/Users?api_key=${apiKey}`)).json()) as Array<{ Id: string; Name: string }>;
  const admin = users.find((u) => u.Name === "admin");
  if (!admin) throw new Error("compte admin absent du Jellyfin jetable");
  const { applyCoreMigrations } = require(join(backendDir, "src/services/database/migrator.ts"));
  const { openSqlite } = require(join(backendDir, "src/services/database/nodeSqlite.ts"));
  applyCoreMigrations(dbPath);
  const rows: Record<string, string> = {
    setup_completed: "true",
    jellyfin_url: JF,
    jellyfin_private_url: JF,
    jellyfin_api_key: apiKey,
    admin_jellyfin_id: admin.Id,
    jwt_secret: randomBytes(48).toString("hex"),
  };
  const sqlite = openSqlite(dbPath);
  const upsert = sqlite.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`);
  for (const [k, v] of Object.entries(rows)) upsert.run(k, v);
  sqlite.close();
  console.log("[banc] base posée");
}
main().catch((e) => { console.error(e); process.exit(1); });
