import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { SourceColumn, SourceTable } from "./sourceSchema";
import { createIndexSql, createTableSql } from "./extensionDdl";
import { declaredTypeOf, defaultClause, mariadbDateTimeToMs, toSqliteValue } from "./sqliteTypes";

const col = (name: string, dataType: string, extra: Partial<SourceColumn> = {}): SourceColumn => ({
  name,
  dataType,
  columnType: dataType,
  nullable: true,
  defaultValue: null,
  extra: "",
  ...extra,
});

// La forme des seer_* telle que MariaDB la décrit (extrait fidèle de la 1.24.1).
const seerTmdbCache: SourceTable = {
  name: "seer_tmdb_cache",
  columns: [
    col("media_type", "varchar", { nullable: false }),
    col("tmdb_id", "int", { nullable: false }),
    col("title", "varchar", { nullable: false, defaultValue: "''" }),
    col("vote_average", "decimal"),
    col("is_anime", "tinyint", { nullable: false, defaultValue: "0" }),
    col("fetched_at", "datetime", { nullable: false, defaultValue: "current_timestamp()" }),
    col("expires_at", "datetime", { nullable: false }),
  ],
  primaryKey: ["media_type", "tmdb_id"],
  keyColumns: ["media_type", "tmdb_id"],
  indexes: [{ name: "idx_tmdbc_expires", unique: false, columns: ["expires_at"] }],
  approxRows: 0,
  approxBytes: 0,
};

describe("copie générique : types, valeurs, DDL (docs/sqlite/GENERIC-COPY.md)", () => {
  it("types déclarés", () => {
    expect(declaredTypeOf(col("a", "datetime"))).toBe("DATETIME");
    expect(declaredTypeOf(col("a", "timestamp"))).toBe("DATETIME");
    expect(declaredTypeOf(col("a", "decimal"))).toBe("REAL");
    expect(declaredTypeOf(col("a", "tinyint"))).toBe("INTEGER");
    expect(declaredTypeOf(col("a", "longtext"))).toBe("TEXT");
    expect(declaredTypeOf(col("a", "date"))).toBe("TEXT");
    expect(declaredTypeOf(col("a", "varbinary"))).toBe("BLOB");
  });

  it("DATETIME → millisecondes UTC ; microsecondes tronquées ; « zéro » → NULL ou 0", () => {
    expect(mariadbDateTimeToMs("2026-10-08 12:44:47.674")).toBe(Date.UTC(2026, 9, 8, 12, 44, 47, 674));
    expect(mariadbDateTimeToMs("2026-10-08 12:44:47.674999")).toBe(Date.UTC(2026, 9, 8, 12, 44, 47, 674));
    expect(mariadbDateTimeToMs("2026-10-08 12:44:47")).toBe(Date.UTC(2026, 9, 8, 12, 44, 47));
    expect(toSqliteValue(col("d", "datetime"), "0000-00-00 00:00:00")).toBeNull();
    expect(toSqliteValue(col("d", "datetime", { nullable: false }), "0000-00-00 00:00:00")).toBe(0);
  });

  it("valeurs : DECIMAL en nombre, BIGINT sûr en nombre, hors de ±2⁵³ exact", () => {
    expect(toSqliteValue(col("v", "decimal"), "8.500")).toBe(8.5);
    expect(toSqliteValue(col("v", "bigint"), 42n)).toBe(42);
    expect(toSqliteValue(col("v", "bigint"), 2n ** 60n)).toBe(2n ** 60n);
    expect(toSqliteValue(col("v", "longtext"), '{"1":[1,2]}')).toBe('{"1":[1,2]}');
  });

  it("défauts : littéraux recopiés, « maintenant » en ENTIER, le reste omis", () => {
    expect(defaultClause(col("s", "varchar", { defaultValue: "'pending'" }))).toBe("'pending'");
    expect(defaultClause(col("n", "int", { defaultValue: "20" }))).toBe("20");
    expect(defaultClause(col("d", "datetime", { defaultValue: "current_timestamp(3)" }))).toBe(
      "(CAST(unixepoch('subsec') * 1000 AS INTEGER))",
    );
    expect(defaultClause(col("x", "varchar", { defaultValue: "uuid()" }))).toBeNull();
  });

  it("une vraie base SQLite accepte le DDL ; clé composée, index sous son nom, défaut entier", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(createTableSql(seerTmdbCache));
    for (const sql of createIndexSql(seerTmdbCache, new Set())) db.exec(sql);
    db.prepare(`INSERT INTO seer_tmdb_cache (media_type, tmdb_id, vote_average, expires_at) VALUES (?, ?, ?, ?)`).run("movie", 1, 7.5, 5);
    const row = db.prepare("SELECT typeof(fetched_at) AS t, title, is_anime FROM seer_tmdb_cache").get() as Record<string, unknown>;
    expect(row).toEqual({ t: "integer", title: "", is_anime: 0 });
    const pk = db.prepare("SELECT name FROM pragma_table_info('seer_tmdb_cache') WHERE pk > 0 ORDER BY pk").all();
    expect(pk.map((r) => (r as { name: string }).name)).toEqual(["media_type", "tmdb_id"]);
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tmdbc_expires'").all();
    expect(idx).toHaveLength(1);
    expect(() =>
      db.prepare(`INSERT INTO seer_tmdb_cache (media_type, tmdb_id, expires_at) VALUES ('movie', 1, 0)`).run(),
    ).toThrow(/UNIQUE/);
  });

  it("un nom d'index déjà pris ailleurs reçoit le préfixe de sa table", () => {
    const taken = new Set(["idx_tmdbc_expires"]);
    expect(createIndexSql(seerTmdbCache, taken)[0]).toContain('"seer_tmdb_cache_idx_tmdbc_expires"');
  });
});
