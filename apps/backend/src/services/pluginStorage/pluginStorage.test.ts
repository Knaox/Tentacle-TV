import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPluginStorage } from "./createPluginStorage";
import { openTestDatabase, PLUGIN_MIGRATIONS_DDL, sqliteExecutor, type TestDatabase } from "./sqliteTestExecutor";
import type { PluginMigration, PluginStorage } from "./types";

/*
 * L'interface de stockage des extensions, sur une VRAIE SQLite : upsert,
 * entiers normalisés, introspection, transactions, migrations versionnées.
 */

let db: TestDatabase;
let storage: PluginStorage;

beforeEach(() => {
  db = openTestDatabase();
  db.exec(PLUGIN_MIGRATIONS_DDL);
  storage = createPluginStorage({
    pluginId: "demo", dialect: "sqlite", dateFormat: "iso8601", executor: sqliteExecutor(db),
  });
});
afterEach(() => db.close());

const createTable: PluginMigration = {
  version: 1,
  name: "tables",
  up: async (s) => {
    await s.execute("CREATE TABLE IF NOT EXISTS demo_items (id TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, label TEXT)");
  },
};

describe("requêtes", () => {
  it("rend des entiers, jamais un BigInt", async () => {
    await storage.migrate([createTable]);
    await storage.execute("INSERT INTO demo_items (id, hits) VALUES (?, ?)", "a", 9_007_199_254_740_991n);
    const [row] = await storage.query<{ n: unknown; hits: unknown }>("SELECT COUNT(*) AS n, MAX(hits) AS hits FROM demo_items");
    expect(typeof row.n).toBe("number");
    expect(row.hits).toBe(9_007_199_254_740_991);
  });

  it("upsert : insère, puis met à jour sur conflit", async () => {
    await storage.migrate([createTable]);
    const upsert = storage.sql.upsert({
      table: "demo_items", columns: ["id", "hits", "label"], conflict: ["id"],
      update: [["hits", "hits + {new:hits}"], "label"],
    });
    await storage.execute(upsert, "a", 1, "un");
    await storage.execute(upsert, "a", 2, "deux");
    expect(await storage.query("SELECT id, hits, label FROM demo_items")).toEqual([{ id: "a", hits: 3, label: "deux" }]);
  });

  it("insertIgnore laisse la ligne en place", async () => {
    await storage.migrate([createTable]);
    await storage.execute(`${storage.sql.insertIgnore()} INTO demo_items (id, label) VALUES (?, ?)`, "a", "premier");
    await storage.execute(`${storage.sql.insertIgnore()} INTO demo_items (id, label) VALUES (?, ?)`, "a", "second");
    expect(await storage.query("SELECT label FROM demo_items")).toEqual([{ label: "premier" }]);
  });

  it("introspection : colonnes d'une table, table absente", async () => {
    await storage.migrate([createTable]);
    expect(await storage.columns("demo_items")).toEqual(["id", "hits", "label"]);
    expect(await storage.tableExists("demo_absent")).toBe(false);
    await expect(storage.columns("x; DROP TABLE demo_items")).rejects.toThrow(/identifiant refusé/);
  });

  it("une transaction en échec ne laisse rien", async () => {
    await storage.migrate([createTable]);
    await expect(storage.transaction(async (tx) => {
      await tx.execute("INSERT INTO demo_items (id) VALUES (?)", "a");
      throw new Error("panne");
    })).rejects.toThrow("panne");
    expect(await storage.query("SELECT id FROM demo_items")).toEqual([]);
  });
});

describe("migrations versionnées", () => {
  it("chaque version ne passe qu'une fois", async () => {
    expect(await storage.migrate([createTable])).toEqual([1]);
    expect(await storage.migrate([createTable])).toEqual([]);
    const second: PluginMigration = {
      version: 2, name: "colonne", up: async (s) => { await s.execute("ALTER TABLE demo_items ADD COLUMN extra TEXT"); },
    };
    expect(await storage.migrate([second, createTable])).toEqual([2]);
    expect(await storage.columns("demo_items")).toContain("extra");
  });

  it("une migration qui échoue n'est pas notée et ne laisse rien à moitié", async () => {
    const broken: PluginMigration = {
      version: 1,
      name: "cassée",
      up: async (s) => {
        await s.execute("CREATE TABLE demo_half (id TEXT)");
        await s.execute("CREATE TABLE demo_half (id TEXT)");
      },
    };
    await expect(storage.migrate([broken])).rejects.toThrow(/migration 1 \(cassée\) en échec/);
    expect(await storage.tableExists("demo_half")).toBe(false);
    expect(await storage.query("SELECT * FROM plugin_migrations")).toEqual([]);
  });

  it("les traces sont propres à chaque extension", async () => {
    await storage.migrate([createTable]);
    const other = createPluginStorage({
      pluginId: "autre", dialect: "sqlite", dateFormat: "iso8601", executor: sqliteExecutor(db),
    });
    expect(await other.migrate([createTable])).toEqual([1]);
  });

  it("refuse une version invalide ou en double", async () => {
    await expect(storage.migrate([{ ...createTable, version: 0 }])).rejects.toThrow(/invalide/);
    await expect(storage.migrate([createTable, createTable])).rejects.toThrow(/en double/);
  });
});
