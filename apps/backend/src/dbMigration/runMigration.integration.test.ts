import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as mariadb from "mariadb";
import { connectionOptions } from "./legacySource/sourceConfig";
import { runMigration } from "./runMigration";
import { runApiSample } from "./verify/apiSample";
import { coreModels } from "./copy/coreModels";
import { CACHE_TABLES, DEFERRED_TABLES } from "./bootMigration";
import { applyCoreMigrations } from "../services/database/migrator";
import { openSqlite } from "../services/database/nodeSqlite";
import { MIGRATION_REPORT_KEY } from "../services/database/legacySource";
import { scratchDatabaseUrl } from "../../test/mariadbScratch";

/**
 * L'orchestrateur ENTIER contre une vraie MariaDB jetable (la même que les autres tests
 * d'intégration, dans SA base), avec le VRAI contrôle par Prisma dans son processus
 * enfant : aucun test ne le jouait de bout en bout, et le banc réel a trouvé l'écart —
 * les deux clés que la migration pose dans server_config (empreinte, rapport) faisaient
 * échouer le contrôle à chaque essai.
 *   TENTACLE_TEST_MARIADB_TZ_URL=mysql://root:…@127.0.0.1:47430/sqlmig pnpm vitest run runMigration
 */
const baseUrl = process.env.TENTACLE_TEST_MARIADB_TZ_URL;

describe.skipIf(!baseUrl)("la migration entière, contrôle par Prisma compris", () => {
  const dir = mkdtempSync(join(tmpdir(), "tentacle-runmigration-"));
  const finalPath = join(dir, "tentacle.db");
  let url: string;

  beforeAll(async () => {
    url = await scratchDatabaseUrl(baseUrl!, "orchestrator");
    const conn = await mariadb.createConnection({ ...connectionOptions(url), multipleStatements: true });
    await conn.query(`CREATE TABLE server_config (\`key\` VARCHAR(191) PRIMARY KEY, \`value\` TEXT NOT NULL);
      CREATE TABLE share_links (id VARCHAR(191) PRIMARY KEY, token VARCHAR(64) NOT NULL);
      CREATE TABLE provisioning_codes (id VARCHAR(191) PRIMARY KEY, code VARCHAR(32) NOT NULL);
      CREATE TABLE seer_user_settings (jellyfin_user_id VARCHAR(64) PRIMARY KEY, jellyseerr_last_sync DATETIME NULL);
      INSERT INTO server_config VALUES ('setup_completed', 'true'), ('jwt_secret', 'banc'), ('user_lang_u1', 'fr');
      INSERT INTO seer_user_settings VALUES ('u1', '2026-10-01 10:00:00'), ('u2', NULL);`);
    await conn.end();
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("copie, vérifie, fait relire par Prisma (clés de la migration comprises), puis bascule", async () => {
    const lines: string[] = [];
    const outcome = await runMigration({
      sourceUrl: url,
      finalPath,
      prepareTarget: (path) => void applyCoreMigrations(path),
      openTarget: (path, options) => openSqlite(path, { foreignKeys: options.foreignKeys }),
      models: coreModels(),
      sealSetup: () => undefined,
      apiSample: (path, expected) => runApiSample(path, expected, ["--import", "tsx"]),
      deferred: DEFERRED_TABLES,
      caches: CACHE_TABLES,
      serverVersion: "1.25.0",
      log: (line) => lines.push(line),
    });
    expect(outcome.kind, lines.join("\n")).toBe("migrated");
    expect(existsSync(finalPath)).toBe(true);
    expect(existsSync(`${finalPath}.migrating`)).toBe(false);
    const db = openSqlite(finalPath, { readOnly: true });
    try {
      const keys = (db.prepare(`SELECT "key" FROM "server_config" ORDER BY "key"`).all() as Array<{ key: string }>).map((r) => r.key);
      expect(keys).toEqual(expect.arrayContaining(["jwt_secret", "setup_completed", "user_lang_u1", MIGRATION_REPORT_KEY]));
      expect(keys).toHaveLength(5);
      expect((db.prepare(`SELECT COUNT(*) AS n FROM "seer_user_settings"`).get() as { n: number }).n).toBe(2);
    } finally {
      db.close();
    }
  }, 120_000);
});
