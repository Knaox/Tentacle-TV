import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as mariadb from "mariadb";
import { MariadbReader } from "./mariadbReader";
import { connectionOptions } from "./sourceConfig";
import { extensionPlan, type PlanContext } from "../copy/tablePlans";
import { convertRow } from "../copy/tableCopy";

/**
 * Contre une VRAIE MariaDB jetable réglée sur Europe/Paris, seulement si on la donne :
 *   TENTACLE_TEST_MARIADB_TZ_URL=mysql://root:…@127.0.0.1:47430/sqlmig pnpm vitest run mariadbReader
 * (par exemple `podman run -e TZ=Europe/Paris -e MARIADB_ROOT_PASSWORD=… -e MARIADB_DATABASE=sqlmig
 * -p 127.0.0.1:47430:3306 mariadb:11.8`). Le test y crée ses tables : la base doit être sacrifiable.
 */
const url = process.env.TENTACLE_TEST_MARIADB_TZ_URL;

describe.skipIf(!url)("lecteur MariaDB, sur une source en heure de Paris", () => {
  let reader: MariadbReader;

  beforeAll(async () => {
    const conn = await mariadb.createConnection({ ...connectionOptions(url!), multipleStatements: true });
    // Ce qu'écrivait Vigie : NOW() dans le fuseau de la session (Paris), et une date JS liée (UTC).
    await conn.query(`DROP TABLE IF EXISTS seer_cleanup_queue, seer_tmdb_cache;
      CREATE TABLE seer_cleanup_queue (id VARCHAR(36) PRIMARY KEY, next_retry_at DATETIME NOT NULL, created_at DATETIME NOT NULL);
      CREATE TABLE seer_tmdb_cache (media_type VARCHAR(10), tmdb_id INT, expires_at DATETIME NOT NULL, fetched_at DATETIME NOT NULL,
        PRIMARY KEY (media_type, tmdb_id));
      INSERT INTO seer_cleanup_queue VALUES ('hiver', '2026-01-15 12:00:00', '2026-01-15 12:00:00'), ('ete', '2026-07-15 12:00:00', '2026-07-15 12:00:00');
      INSERT INTO seer_tmdb_cache VALUES ('movie', 1, '2026-07-15 10:00:00', '2026-07-15 12:00:00');`);
    await conn.end();
    reader = await MariadbReader.open(url!);
  });
  afterAll(async () => {
    await reader?.close();
  });

  it("le fuseau de la source est lu (SYSTEM sur un hôte en heure locale)", () => {
    expect(reader.sourceZone).toBe("SYSTEM");
  });

  it("une colonne « session » est convertie en UTC, heure d'été comprise ; une colonne UTC reste telle quelle", async () => {
    const tables = await reader.tables();
    const ctx: PlanContext = { sourceZone: reader.sourceZone, startedAt: 0, zeroDates: new Map() };
    const queue = extensionPlan(tables.find((t) => t.name === "seer_cleanup_queue")!, ctx);
    const rows = (await reader.page(queue.source, queue.sourceColumns, { after: null }, 10)).map((r) => convertRow(queue, r));
    expect(rows.find((r) => r.id === "hiver")!.next_retry_at).toBe(Date.UTC(2026, 0, 15, 11, 0, 0));
    expect(rows.find((r) => r.id === "ete")!.next_retry_at).toBe(Date.UTC(2026, 6, 15, 10, 0, 0));

    const cache = extensionPlan(tables.find((t) => t.name === "seer_tmdb_cache")!, ctx);
    const [row] = (await reader.page(cache.source, cache.sourceColumns, { after: null }, 10)).map((r) => convertRow(cache, r));
    expect(row.expires_at).toBe(Date.UTC(2026, 6, 15, 10, 0, 0)); // date JS liée : déjà UTC
    expect(row.fetched_at).toBe(Date.UTC(2026, 6, 15, 10, 0, 0)); // NOW() de Paris → UTC
  });

  it("la lecture se fait par pages sur la clé composée, sans rien perdre", async () => {
    const tables = await reader.tables();
    const cache = tables.find((t) => t.name === "seer_tmdb_cache")!;
    expect(cache.keyColumns).toEqual(["media_type", "tmdb_id"]);
    const first = await reader.page(cache, [{ name: "media_type" }, { name: "tmdb_id" }], { after: null }, 1);
    const next = await reader.page(cache, [{ name: "media_type" }, { name: "tmdb_id" }], { after: first[0] }, 1);
    expect(first).toHaveLength(1);
    expect(next).toHaveLength(0);
  });

  it("MariaDB refuse toute écriture dans la transaction du lecteur : la source ne peut pas être modifiée", async () => {
    const conn = (reader as unknown as { conn: mariadb.Connection }).conn;
    await expect(conn.query("DELETE FROM seer_cleanup_queue")).rejects.toThrow(/READ ONLY/i);
    await expect(conn.query("CREATE TABLE intrus (x INT)")).rejects.toThrow();
  });
});
