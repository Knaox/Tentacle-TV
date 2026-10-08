import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { afterAll, describe, expect, it } from "vitest";
import { inspectLegacySource, legacyConfigFile, legacyMariadbUrl, legacySourceOrigin, MIGRATION_REPORT_KEY } from "../../src/services/database/legacySource";
import { applyCoreMigrations } from "../../src/services/database/migrator";
import { openSqlite } from "../../src/services/database/nodeSqlite";
import { tempDatabaseDir } from "./tempDatabase";

/**
 * La MariaDB d'avant 1.25, vue comme SOURCE seulement : quand ses données
 * attendent leur migration, et quand une base SQLite est née sans elle.
 */
const temp = tempDatabaseDir();
afterAll(() => temp.cleanup());

const MARIADB = { DATABASE_URL: "mysql://tentacle:secret@db:3306/tentacle" };
let count = 0;
function dataDir(rows?: Record<string, string>): string {
  const dir = join(temp.dir, `data-${++count}`);
  if (rows) {
    const path = join(dir, "tentacle.db");
    applyCoreMigrations(path);
    const db = openSqlite(path);
    for (const [key, value] of Object.entries(rows)) db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?)`).run(key, value);
    db.close();
  } else {
    // Le dossier seul, sans base.
    applyCoreMigrations(join(dir, "probe.db"));
  }
  return dir;
}

describe("source MariaDB d'avant 1.25", () => {
  it("désignée par l'environnement ou par data/database.json, en mysql:// seulement", () => {
    const dir = dataDir();
    expect(legacyMariadbUrl({}, dir)).toBeNull();
    expect(legacyMariadbUrl(MARIADB, dir)).toBe(MARIADB.DATABASE_URL);
    expect(legacyMariadbUrl({ DATABASE_URL: "file:./x.db" }, dir)).toBeNull();
    writeFileSync(join(dir, "database.json"), JSON.stringify({ url: "mysql://u:p@nas:3307/t" }));
    expect(legacyMariadbUrl({}, dir)).toBe("mysql://u:p@nas:3307/t");
  });

  it("son origine — l'environnement l'emporte sur le fichier de l'ancien assistant —, pour dire QUOI retirer", () => {
    const dir = dataDir();
    expect(legacySourceOrigin({}, dir)).toBeNull();
    expect(legacySourceOrigin(MARIADB, dir)).toBe("env");
    writeFileSync(join(dir, "database.json"), JSON.stringify({ url: "mysql://u:p@nas:3307/t" }));
    expect(legacySourceOrigin({}, dir)).toBe("file");
    expect(legacySourceOrigin(MARIADB, dir)).toBe("env");
    expect(legacyConfigFile(dir)).toBe(join(dir, "database.json"));
  });

  it("aucune MariaDB : SQLite est la seule base", () => {
    expect(inspectLegacySource({}, dataDir())).toBe("none");
    expect(inspectLegacySource({}, dataDir({ setup_completed: "true" }))).toBe("none");
  });

  it("une MariaDB sans tentacle.db : migration en attente", () => {
    expect(inspectLegacySource(MARIADB, dataDir())).toBe("pending");
  });

  it("une tentacle.db jamais installée face à une MariaDB : toujours en attente (la migration la met de côté)", () => {
    expect(inspectLegacySource(MARIADB, dataDir({}))).toBe("pending");
    const empty = dataDir();
    writeFileSync(join(empty, "tentacle.db"), "");
    expect(inspectLegacySource(MARIADB, empty)).toBe("pending");
  });

  it("une tentacle.db installée SANS migration face à une MariaDB : « jamais migrée », rien d'automatique", () => {
    expect(inspectLegacySource(MARIADB, dataDir({ setup_completed: "true" }))).toBe("never_migrated");
  });

  it("une tentacle.db née de la migration : migrée", () => {
    expect(inspectLegacySource(MARIADB, dataDir({ setup_completed: "true", [MIGRATION_REPORT_KEY]: "{}" }))).toBe("migrated");
  });

  it("la lecture ne modifie pas la base", () => {
    const dir = dataDir({ setup_completed: "true" });
    const before = statSync(join(dir, "tentacle.db")).mtimeMs;
    inspectLegacySource(MARIADB, dir);
    expect(statSync(join(dir, "tentacle.db")).mtimeMs).toBe(before);
  });
});

describe("data/database.json n'est plus écrit par personne", () => {
  it("aucun fichier du serveur ne l'écrit : il ne fait que désigner une source", () => {
    const src = resolve(__dirname, "../../src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) files.push(path);
      }
    };
    walk(src);
    const naming = files.filter((file) => readFileSync(file, "utf-8").includes("database.json"));
    expect(naming.map((file) => file.slice(src.length + 1)).sort()).toEqual(["services/database/legacySource.ts"]);
    expect(readFileSync(naming[0], "utf-8")).not.toMatch(/writeFile|appendFile|createWriteStream|renameSync/);
  });
});
