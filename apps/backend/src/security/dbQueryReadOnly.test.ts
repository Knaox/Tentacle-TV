import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runDbCommand } from "../cli/dbQueryCommand";

/**
 * `tentacle db query` est vendue « lecture seule » (audit du chantier SQLite,
 * constat D1) : rien ne s'écrit, ni dans la base ni À CÔTÉ. `VACUUM INTO`
 * passait la lecture seule du fichier et `query_only`, et recopiait toute la
 * base — secrets compris — où on voulait. Ici, une vraie base en WAL, tenue
 * ouverte par un « serveur », reçoit chaque détour connu : aucun ne passe, et
 * le dossier ne gagne aucun fichier.
 */

let dir = "";
let path = "";
let server: DatabaseSync;
const errors: string[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "db-query-ro-"));
  path = join(dir, "tentacle.db");
  server = new DatabaseSync(path);
  server.exec("PRAGMA journal_mode = WAL; CREATE TABLE s (k TEXT PRIMARY KEY, v TEXT); INSERT INTO s VALUES ('jwt_secret', 'x');");
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args.join(" ")); });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const run = (sql: string) => runDbCommand("query", [sql], path);

describe("tentacle db query — lecture seule tenue par le moteur", () => {
  it("lit", () => {
    expect(run("SELECT k FROM s")).toBe(0);
    expect(run("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(0);
  });

  it.each([
    ["VACUUM INTO", () => `VACUUM INTO '${join(dir, "copie1.db")}'`],
    ["VACUUM INTO déguisé", () => `  /* lecture */ vacuum main into '${join(dir, "copie2.db")}'`],
    ["seconde instruction", () => `SELECT 1; VACUUM INTO '${join(dir, "copie3.db")}'`],
    ["ATTACH", () => `ATTACH '${join(dir, "autre.db")}' AS a`],
    ["écriture", () => "INSERT INTO s VALUES ('k', 'v')"],
    ["PRAGMA optimize", () => "PRAGMA optimize"],
    ["checkpoint", () => "PRAGMA wal_checkpoint(TRUNCATE)"],
    ["table temporaire", () => "CREATE TEMP TABLE t (a)"],
    ["extension", () => "SELECT load_extension('x')"],
  ])("refuse : %s", (_label, sql) => {
    expect(run(sql())).toBe(1);
  });

  it("le dossier n'a gagné aucun fichier, la base n'a pas bougé", () => {
    const extra = readdirSync(dir).filter((name) => !/^tentacle\.db(-wal|-shm)?$/.test(name));
    expect(extra).toEqual([]);
    expect(server.prepare("SELECT COUNT(*) AS n FROM s").get()).toEqual({ n: 1 });
  });
});
