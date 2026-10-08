import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as mariadb from "mariadb";
import { checkSourceDivergence, currentFingerprint } from "./sourceDivergence";
import { MariadbReader } from "../legacySource/mariadbReader";
import { connectionOptions, sourceIdentity } from "../legacySource/sourceConfig";
import { coreModels } from "../copy/coreModels";
import type { MigrationReport } from "../migrationReport";
import { scratchDatabaseUrl } from "../../../test/mariadbScratch";

const models = coreModels();
const ignored = new Set(["tmdb_meta_cache"]);

function reportFor(url: string, extra: Partial<MigrationReport> = {}): MigrationReport {
  return {
    version: 1, serverVersion: "1.25.0", startedAt: 0, finishedAt: 0, durationMs: 0,
    source: { engine: "mariadb", version: "", bytes: 0, zoneConverted: false, identity: sourceIdentity(url) },
    disk: { requiredBytes: 0, freeBytes: 0 }, rowsWritten: 0, tables: [], retired: [], unrecognized: [], refused: [], deferred: [],
    zeroDates: {}, foreignKeyOrphans: {}, familyOrphansDropped: 0, ...extra,
  };
}

describe("divergence de la source (§ 3.10) — sans connexion", () => {
  it("rien à dire sans source ni rapport", async () => {
    expect(await checkSourceDivergence({ url: null, report: null, fingerprint: null, models, ignored })).toEqual({ status: "none" });
  });

  it("une AUTRE base configurée que celle de la migration (hôte, port ou nom) : signalée sans s'y connecter", async () => {
    const report = reportFor("mysql://u:p@db:3306/tentacle");
    for (const other of ["mysql://u:p@nas:3306/tentacle", "mysql://u:p@db:3307/tentacle", "mysql://u:p@db:3306/tentacle_old"]) {
      expect(await checkSourceDivergence({ url: other, report, fingerprint: {}, models, ignored })).toEqual({ status: "changed", why: "identity" });
    }
  });

  it("MariaDB retirée (injoignable) : pas une divergence, rien à signaler", async () => {
    const url = "mysql://u:p@127.0.0.1:1/tentacle?connect_timeout=1";
    expect(await checkSourceDivergence({ url, report: reportFor(url), fingerprint: {}, models, ignored })).toEqual({ status: "unreachable" });
  });
});

/** Contre une vraie MariaDB jetable (la même que les autres tests d'intégration de la migration), dans SA base. */
const baseUrl = process.env.TENTACLE_TEST_MARIADB_TZ_URL;
let url: string;

describe.skipIf(!baseUrl)("divergence de la source — sur une vraie MariaDB", () => {
  let baseline: Record<string, { rows: number; sum: string }>;
  const exec = async (sql: string) => {
    const conn = await mariadb.createConnection({ ...connectionOptions(url), multipleStatements: true });
    await conn.query(sql);
    await conn.end();
  };

  beforeAll(async () => {
    url = await scratchDatabaseUrl(baseUrl!, "divergence");
    await exec(`DROP TABLE IF EXISTS server_config, share_links, provisioning_codes, tmdb_meta_cache, seer_cleanup_queue, seer_tmdb_cache;
      CREATE TABLE server_config (\`key\` VARCHAR(100) PRIMARY KEY, \`value\` TEXT NOT NULL);
      CREATE TABLE share_links (id VARCHAR(191) PRIMARY KEY, token VARCHAR(32) NOT NULL);
      CREATE TABLE provisioning_codes (id VARCHAR(191) PRIMARY KEY, code VARCHAR(32) NOT NULL);
      INSERT INTO server_config VALUES ('setup_completed', 'true'), ('tv_pairing_epoch', '1');`);
    const reader = await MariadbReader.open(url);
    try {
      baseline = (await currentFingerprint(reader, models, ignored)).result;
    } finally {
      await reader.close();
    }
  });
  afterAll(() => exec("DROP TABLE IF EXISTS server_config, share_links, provisioning_codes"));

  it("la même source, inchangée : rien", async () => {
    expect(await checkSourceDivergence({ url: url, report: reportFor(url), fingerprint: baseline, models, ignored })).toEqual({ status: "same" });
  });

  it("l'image d'avant remise en service y a écrit : la divergence est DÉTECTÉE", async () => {
    await exec("UPDATE server_config SET `value` = '2' WHERE `key` = 'tv_pairing_epoch'");
    expect(await checkSourceDivergence({ url: url, report: reportFor(url), fingerprint: baseline, models, ignored })).toEqual({ status: "changed", why: "data" });
  });

  it("une source vide à la migration qui a maintenant des tables du cœur : signalée", async () => {
    const report = reportFor(url, { sourceEmpty: true });
    expect(await checkSourceDivergence({ url: url, report, fingerprint: {}, models, ignored })).toEqual({ status: "changed", why: "was_empty" });
  });
});
