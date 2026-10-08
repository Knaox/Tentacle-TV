import { existsSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/dataDir", async () => {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  return { DATA_ROOT: mkdtempSync(join(tmpdir(), "wiz-cli-")) };
});
import { DATA_ROOT } from "../services/dataDir";
import { applyCoreMigrations } from "../services/database/migrator";
import { openSqlite } from "../services/database/nodeSqlite";
import { coreDatabasePath } from "../services/database/sqlitePath";
import { normalizeArgs, runCli } from "./tentacle";

const lock = join(DATA_ROOT, "setup-complete");
const token = join(DATA_ROOT, "setup-token.txt");
const database = coreDatabasePath();

/** Une vraie base SQLite au chemin du serveur, avec ces lignes dans `server_config`. */
function seedDatabase(rows: Record<string, string>): void {
  applyCoreMigrations(database);
  const db = openSqlite(database);
  for (const [key, value] of Object.entries(rows)) {
    db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?)`).run(key, value);
  }
  db.close();
}
const configKeys = (): string[] => {
  const db = openSqlite(database, { readOnly: true });
  const keys = (db.prepare(`SELECT "key" FROM "server_config" ORDER BY "key"`).all() as Array<{ key: string }>).map((r) => r.key);
  db.close();
  return keys;
};

afterAll(() => rmSync(DATA_ROOT, { recursive: true, force: true }));
beforeEach(() => {
  for (const file of [lock, token, database, `${database}-wal`, `${database}-shm`]) rmSync(file, { force: true });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("tentacle setup", () => {
  it("refuse ce qu'elle ne connaît pas, en redonnant l'usage complet", async () => {
    expect(await runCli([])).toBe(2);
    expect(await runCli(["setup", "open"])).toBe(2);
    const said = vi.mocked(console.error).mock.calls.flat().join("\n");
    expect(said).toContain("Commande inconnue / unknown command : tentacle setup open");
    expect(said).toContain("tentacle setup token   affiche un code d'installation neuf");
    expect(said).toContain("tentacle setup reset");
  });

  it("l'aide se demande, et répond sans erreur", async () => {
    expect(await runCli(["--help"])).toBe(0);
    expect(await runCli(["tentacle", "help"])).toBe(0);
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain("print a new one-time setup code");
  });

  it("`tentacle tentacle setup token` est pardonné : le nom tapé deux fois est ignoré", async () => {
    expect(normalizeArgs(["tentacle", "setup", "token"])).toEqual(["setup", "token"]);
    expect(normalizeArgs(["Tentacle", "tentacle", "SETUP", "Token"])).toEqual(["setup", "token"]);
    expect(await runCli(["tentacle", "setup", "token"], {})).toBe(0);
    expect(existsSync(token)).toBe(true);
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  });

  it("token : un code neuf tant que l'installation est ouverte", async () => {
    seedDatabase({});
    expect(await runCli(["setup", "token"], {})).toBe(0);
    expect(existsSync(token)).toBe(true);
  });

  it("token : refusé une fois l'installation finie (fichier verrou ou base)", async () => {
    writeFileSync(lock, "x");
    expect(await runCli(["setup", "token"], {})).toBe(1);
    rmSync(lock);
    seedDatabase({ setup_completed: "true" });
    expect(await runCli(["setup", "token"], {})).toBe(1);
    expect(existsSync(token)).toBe(false);
  });

  it("reset : drapeaux effacés, verrou retiré, et aucun code — le redémarrage en écrit un", async () => {
    writeFileSync(lock, "x");
    writeFileSync(token, "AAAA-BBBB-CCCC\n");
    seedDatabase({ setup_completed: "true", admin_jellyfin_id: "a", admin_username: "b", setup_tmdb_later: "1", jwt_secret: "s" });
    expect(await runCli(["setup", "reset"], {})).toBe(0);
    // Les drapeaux de l'assistant seulement : le reste de la configuration demeure.
    expect(configKeys()).toEqual(["jwt_secret"]);
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(token)).toBe(false);
    const printed = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(printed).toContain("Redémarrez le serveur");
    expect(printed).not.toContain("docker compose");
    expect(printed).not.toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  });

  it("reset sans base (data/tentacle.db absente) : rien n'est touché, rien n'est créé", async () => {
    writeFileSync(lock, "x");
    expect(await runCli(["setup", "reset"], {})).toBe(1);
    expect(existsSync(lock)).toBe(true);
    expect(existsSync(database)).toBe(false);
  });
});
