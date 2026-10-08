import { readdirSync, rmSync } from "fs";
import { join } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "db-cli-")) };
});

import { DATA_ROOT } from "../services/dataDir";
import { applyCoreMigrations } from "../services/database/migrator";
import { openSqlite } from "../services/database/nodeSqlite";
import { coreDatabasePath } from "../services/database/sqlitePath";
import { runCli } from "./tentacle";

const printed = () => vi.mocked(console.log).mock.calls.map((call) => call.join(" "));
const said = () => vi.mocked(console.error).mock.calls.flat().join("\n");

beforeAll(() => {
  applyCoreMigrations(coreDatabasePath());
  const db = openSqlite(coreDatabasePath());
  db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?), (?, ?)`).run("jellyfin_url", "http://Jellyfin:8096", "note", "deux\tmots");
  db.close();
});
afterAll(() => rmSync(DATA_ROOT, { recursive: true, force: true }));
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("tentacle db query", () => {
  it("lit la base : en-tête puis lignes séparées par des tabulations, la casse de la requête gardée", async () => {
    expect(await runCli(["tentacle", "db", "query", "SELECT `key`, value FROM server_config WHERE value LIKE 'http://Jellyfin%'"])).toBe(0);
    expect(printed()).toEqual(["key\tvalue", "jellyfin_url\thttp://Jellyfin:8096"]);
  });

  it("--no-header pour un script, --json pour une machine", async () => {
    expect(await runCli(["db", "query", "--no-header", "SELECT value FROM server_config WHERE key = 'note'"])).toBe(0);
    expect(printed()).toEqual(["deux mots"]);
    vi.mocked(console.log).mockClear();
    expect(await runCli(["db", "query", "--json", "SELECT COUNT(*) AS n FROM server_config"])).toBe(0);
    expect(printed()).toEqual(['[{"n":2}]']);
  });

  it("refuse toute écriture : la base reste intacte", async () => {
    expect(await runCli(["db", "query", "DELETE FROM server_config"])).toBe(1);
    expect(said()).toMatch(/read-only/i);
    expect(await runCli(["db", "query", "--json", "SELECT COUNT(*) AS n FROM server_config"])).toBe(0);
    expect(printed().at(-1)).toBe('[{"n":2}]');
  });

  it("VACUUM INTO (qui passait la lecture seule) est refusé, sous toutes ses formes, et rien n'est écrit", async () => {
    const before = readdirSync(DATA_ROOT).sort();
    for (const sql of [
      `VACUUM INTO '${join(DATA_ROOT, "copie.db")}'`,
      `/* c */ VACUUM INTO '${join(DATA_ROOT, "copie2.db")}'`,
      `VACUUM main INTO '${join(DATA_ROOT, "copie3.db")}'`,
    ]) {
      expect(await runCli(["db", "query", sql])).toBe(1);
    }
    expect(said()).toContain("(Vacuum)");
    expect(readdirSync(DATA_ROOT).sort()).toEqual(before);
  });

  it("une seule instruction : « SELECT 1; INSERT … » est refusé en entier", async () => {
    expect(await runCli(["db", "query", "SELECT 1; INSERT INTO server_config (key, value) VALUES ('x', 'y')"])).toBe(1);
    expect(said()).toContain("une seule instruction");
    expect(await runCli(["db", "query", "PRAGMA query_only = OFF; INSERT INTO server_config (key, value) VALUES ('x', 'y')"])).toBe(1);
    expect(await runCli(["db", "query", "INSERT INTO server_config (key, value) VALUES ('x', 'y')"])).toBe(1);
    expect(await runCli(["db", "query", "SELECT 1 AS un;"])).toBe(0);
    expect(await runCli(["db", "query", "--json", "SELECT COUNT(*) AS n FROM server_config"])).toBe(0);
    expect(printed().at(-1)).toBe('[{"n":2}]');
  });

  it("ni PRAGMA qui écrit, ni ATTACH", async () => {
    for (const sql of ["PRAGMA user_version = 5", "PRAGMA journal_mode = DELETE", "PRAGMA wal_checkpoint", "ANALYZE", `ATTACH '${join(DATA_ROOT, "autre.db")}' AS autre`]) {
      expect(await runCli(["db", "query", sql]), sql).toBe(1);
    }
    // Un PRAGMA qui ne fait que lire passe ; `journal_mode`, même lu, passe par son opcode : refusé.
    expect(await runCli(["db", "query", "PRAGMA table_info(server_config)"])).toBe(0);
  });

  it("une requête invalide ou absente : un refus clair, jamais une pile d'erreur", async () => {
    expect(await runCli(["db", "query", "SELEC nope"])).toBe(1);
    expect(said()).toContain("Requête refusée / query refused");
    expect(await runCli(["db", "query"])).toBe(2);
    expect(await runCli(["db", "drop"])).toBe(2);
  });
});
