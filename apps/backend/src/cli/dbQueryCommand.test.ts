import { rmSync } from "fs";
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
    expect(said()).toMatch(/readonly|read-only|query_only/i);
    expect(await runCli(["db", "query", "--json", "SELECT COUNT(*) AS n FROM server_config"])).toBe(0);
    expect(printed().at(-1)).toBe('[{"n":2}]');
  });

  it("une requête invalide ou absente : un refus clair, jamais une pile d'erreur", async () => {
    expect(await runCli(["db", "query", "SELEC nope"])).toBe(1);
    expect(said()).toContain("Requête refusée / query refused");
    expect(await runCli(["db", "query"])).toBe(2);
    expect(await runCli(["db", "drop"])).toBe(2);
  });
});
