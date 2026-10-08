import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as mariadb from "mariadb";
import { connectionOptions } from "../legacySource/sourceConfig";
import { applyCoreMigrations } from "../../services/database/migrator";
import { openSqlite } from "../../services/database/nodeSqlite";
import { runCacheCopy } from "./cacheCopyRun";
import { CACHE_CURSOR_KEY, CACHE_DONE_KEY, type CacheChildMessage } from "./cacheCopyProtocol";
import { scratchDatabaseUrl } from "../../../test/mariadbScratch";

/**
 * La copie de fond du cache TMDB contre une VRAIE MariaDB jetable, seulement si
 * on la donne (la même que le test du lecteur), dans SA base (`<base>_cache`) :
 *   TENTACLE_TEST_MARIADB_TZ_URL=mysql://root:…@127.0.0.1:47430/sqlmig pnpm vitest run cacheCopyRun
 */
const baseUrl = process.env.TENTACLE_TEST_MARIADB_TZ_URL;
let url: string;
const ROWS = 23;

describe.skipIf(!baseUrl)("copie de fond du cache TMDB : reprise, ligne vivante, marqueur", () => {
  // Le dossier jetable naît dans beforeAll, jamais au corps du describe : Vitest exécute ce
  // corps même quand la suite est sautée (sans MariaDB), et son afterAll ne tourne alors pas.
  let dir = "";
  let path = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "tentacle-cachecopy-"));
    path = join(dir, "tentacle.db");
    url = await scratchDatabaseUrl(baseUrl!, "cache");
    const conn = await mariadb.createConnection({ ...connectionOptions(url), multipleStatements: true });
    await conn.query(`DROP TABLE IF EXISTS tmdb_meta_cache;
      CREATE TABLE tmdb_meta_cache (mediaType VARCHAR(10) NOT NULL, tmdbId INT NOT NULL, payload MEDIUMTEXT NOT NULL,
        fetchedAt DATETIME(3) NOT NULL, expiresAt DATETIME(3) NOT NULL, PRIMARY KEY (mediaType, tmdbId));`);
    for (let i = 1; i <= ROWS; i++) {
      await conn.query("INSERT INTO tmdb_meta_cache VALUES (?, ?, ?, '2026-10-01 10:00:00.000', '2026-11-01 10:00:00.000')", [
        i % 2 ? "movie" : "tv",
        i,
        `{"id":${i}}`,
      ]);
    }
    await conn.end();
    applyCoreMigrations(path);
    // Le serveur vivant a déjà rangé une fiche fraîche : elle doit gagner.
    const db = openSqlite(path);
    db.prepare(`INSERT INTO "tmdb_meta_cache" ("mediaType","tmdbId","payload","fetchedAt","expiresAt") VALUES ('tv', 4, '{"live":true}', 1, 2)`).run();
    db.close();
  });
  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const config = () => ({ path, url: url, tables: ["tmdb_meta_cache"], batchRows: 5, pauseMs: 0 });

  it("une coupure en plein milieu laisse un curseur, pas de marqueur ; la reprise finit juste après", async () => {
    let lots = 0;
    const interrupted = (m: CacheChildMessage) => {
      if (m.kind === "progress" && m.done > 0 && ++lots === 2) throw new Error("coupure");
    };
    await expect(runCacheCopy(config(), interrupted)).rejects.toThrow("coupure");
    let db = openSqlite(path, { readOnly: true });
    const cursor = db.prepare(`SELECT "value" FROM "server_config" WHERE "key" = ?`).get(CACHE_CURSOR_KEY) as { value: string };
    expect(JSON.parse(cursor.value).table).toBe("tmdb_meta_cache");
    expect(db.prepare(`SELECT 1 FROM "server_config" WHERE "key" = ?`).get(CACHE_DONE_KEY)).toBeUndefined();
    db.close();

    const messages: CacheChildMessage[] = [];
    await runCacheCopy(config(), (m) => messages.push(m));
    expect(messages.at(-1)).toEqual({ kind: "done" });
    db = openSqlite(path, { readOnly: true });
    expect((db.prepare(`SELECT COUNT(*) AS n FROM "tmdb_meta_cache"`).get() as { n: number }).n).toBe(ROWS);
    const live = db.prepare(`SELECT "payload" FROM "tmdb_meta_cache" WHERE "mediaType" = 'tv' AND "tmdbId" = 4`).get() as { payload: string };
    expect(live.payload).toBe('{"live":true}');
    const fetched = db.prepare(`SELECT typeof("fetchedAt") AS t, "fetchedAt" AS v FROM "tmdb_meta_cache" WHERE "tmdbId" = 1`).get() as { t: string; v: number };
    expect(fetched).toEqual({ t: "integer", v: Date.UTC(2026, 9, 1, 10, 0, 0) });
    expect(db.prepare(`SELECT 1 FROM "server_config" WHERE "key" = ?`).get(CACHE_CURSOR_KEY)).toBeUndefined();
    expect(db.prepare(`SELECT 1 FROM "server_config" WHERE "key" = ?`).get(CACHE_DONE_KEY)).toBeDefined();
    db.close();
  });
});
