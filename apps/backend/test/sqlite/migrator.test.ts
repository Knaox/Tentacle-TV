import { chmodSync, existsSync, statSync, symlinkSync, writeFileSync } from "fs";
import { afterAll, describe, expect, it } from "vitest";
import {
  applyCoreMigrations,
  migrationChecksum,
  MigrationChecksumError,
  MIGRATIONS_TABLE,
  readCoreMigrations,
  type CoreMigration,
} from "../../src/services/database/migrator";
import { openSqlite } from "../../src/services/database/nodeSqlite";
import { tempDatabaseDir } from "./tempDatabase";

const temp = tempDatabaseDir();
afterAll(() => temp.cleanup());

const migration = (id: string, sql: string): CoreMigration => ({ id, sql, checksum: migrationChecksum(sql) });
const tables = (path: string): string[] => {
  const db = openSqlite(path, { readOnly: true });
  try {
    return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
  } finally {
    db.close();
  }
};

describe("exécuteur des migrations du cœur", () => {
  it("crée la base, la passe en WAL et applique toutes les migrations commitées", () => {
    const path = temp.use();
    const report = applyCoreMigrations(path);
    const all = readCoreMigrations().map((m) => m.id);
    expect(report).toEqual({ applied: all, unknown: [] });
    expect(tables(path)).toEqual(expect.arrayContaining(["server_config", "paired_devices", MIGRATIONS_TABLE]));
    const db = openSqlite(path, { readOnly: true });
    expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
    db.close();
  });

  it("est idempotent : un second passage n'applique rien", () => {
    const path = temp.use();
    applyCoreMigrations(path);
    expect(applyCoreMigrations(path)).toEqual({ applied: [], unknown: [] });
  });

  it("refuse une migration publiée puis retouchée", () => {
    const path = temp.use();
    applyCoreMigrations(path, [migration("0001_a", "CREATE TABLE a (id INTEGER PRIMARY KEY);")]);
    expect(() => applyCoreMigrations(path, [migration("0001_a", "CREATE TABLE a (id INTEGER PRIMARY KEY, x TEXT);")])).toThrow(
      MigrationChecksumError,
    );
  });

  it("annule toute une migration en échec, et garde les précédentes", () => {
    const path = temp.use();
    const good = migration("0001_a", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    const bad = migration("0002_b", "CREATE TABLE b (id INTEGER PRIMARY KEY);\nINSERT INTO nope VALUES (1);");
    expect(() => applyCoreMigrations(path, [good, bad])).toThrow();
    expect(tables(path)).toEqual(["a", MIGRATIONS_TABLE]);
    expect(applyCoreMigrations(path, [good])).toEqual({ applied: [], unknown: [] });
  });

  it("refuse une migration qui laisse une clé étrangère orpheline", () => {
    const path = temp.use();
    const parent = migration("0001_p", "CREATE TABLE p (id INTEGER PRIMARY KEY);");
    const orphan = migration(
      "0002_c",
      "CREATE TABLE c (id INTEGER PRIMARY KEY, pid INTEGER REFERENCES p(id));\nINSERT INTO c VALUES (1, 42);",
    );
    expect(() => applyCoreMigrations(path, [parent, orphan])).toThrow(/orpheline/);
    expect(tables(path)).not.toContain("c");
  });

  it("signale les migrations d'une version plus récente sans les défaire", () => {
    const path = temp.use();
    const a = migration("0001_a", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    const b = migration("0002_b", "CREATE TABLE b (id INTEGER PRIMARY KEY);");
    applyCoreMigrations(path, [a, b]);
    expect(applyCoreMigrations(path, [a])).toEqual({ applied: [], unknown: ["0002_b"] });
    expect(tables(path)).toContain("b");
  });

  it("ne touche jamais une table d'extension (seer_*), ni sa structure ni ses lignes", () => {
    const path = temp.use();
    const db = openSqlite(path);
    db.exec("CREATE TABLE seer_requests (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)");
    db.prepare("INSERT INTO seer_requests VALUES (?, ?, ?)").run("r1", "🐙 Titre", 1_700_000_000_000);
    const before = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'seer_requests'").get();
    db.close();
    applyCoreMigrations(path);
    const after = openSqlite(path, { readOnly: true });
    expect(after.prepare("SELECT sql FROM sqlite_master WHERE name = 'seer_requests'").get()).toEqual(before);
    expect(after.prepare("SELECT * FROM seer_requests").all()).toEqual([{ id: "r1", title: "🐙 Titre", created_at: 1_700_000_000_000 }]);
    after.close();
  });

  it.skipIf(process.platform === "win32")("crée la base lisible du seul compte du serveur (0600), et y ramène une base d'avant", () => {
    const path = temp.use();
    applyCoreMigrations(path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const db = openSqlite(path);
    db.exec("CREATE TABLE IF NOT EXISTS t (x)");
    expect(statSync(`${path}-wal`).mode & 0o777).toBe(0o600);
    expect(statSync(`${path}-shm`).mode & 0o777).toBe(0o600);
    db.close();
    // Une base d'avant, lisible de tous, y est ramenée.
    chmodSync(path, 0o644);
    applyCoreMigrations(path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it.skipIf(process.platform === "win32")("refuse un lien symbolique à la place de la base ou de son journal", () => {
    const target = temp.use("ailleurs.db");
    writeFileSync(target, "");
    const path = temp.use();
    symlinkSync(target, path);
    expect(() => applyCoreMigrations(path)).toThrow(/lien symbolique/);
    const other = temp.use();
    symlinkSync(target, `${other}-wal`);
    expect(() => applyCoreMigrations(other)).toThrow(/lien symbolique/);
    expect(existsSync(other)).toBe(false);
  });

  it("aucune migration commitée ne nomme une table hors du cœur", () => {
    for (const { id, sql } of readCoreMigrations()) {
      expect(sql, id).not.toMatch(/seer_|plugin_(?!migrations)/i);
    }
  });
});
