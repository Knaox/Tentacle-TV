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
    pluginId: "demo", executor: sqliteExecutor(db),
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
      table: "demo_items", columns: ["id", "hits", "label"], conflict: ["id"], update: ["hits", "label"],
    });
    await storage.execute(upsert, "a", 1, "un");
    await storage.execute(upsert, "a", 2, "deux");
    expect(await storage.query("SELECT id, hits, label FROM demo_items")).toEqual([{ id: "a", hits: 2, label: "deux" }]);
    const many = storage.sql.upsert({ table: "demo_items", columns: ["id", "label"], rows: 2, conflict: ["id"], update: ["label"] });
    await storage.execute(many, "a", "trois", "b", "bé");
    expect(await storage.query("SELECT id, label FROM demo_items ORDER BY id")).toEqual([{ id: "a", label: "trois" }, { id: "b", label: "bé" }]);
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

describe("dates : un INTEGER en millisecondes, que Prisma relit et compare", () => {
  const dated: PluginMigration = {
    version: 1, name: "dates",
    up: async (s) => { await s.execute("CREATE TABLE demo_dates (id TEXT PRIMARY KEY, at DATETIME NOT NULL)"); },
  };

  it("maintenant, décalé, lié : toujours un entier, et les comparaisons tiennent", async () => {
    await storage.migrate([dated]);
    const before = Date.now();
    await storage.execute(`INSERT INTO demo_dates (id, at) VALUES ('now', ${storage.sql.now()})`);
    await storage.execute(`INSERT INTO demo_dates (id, at) VALUES ('past', ${storage.sql.shiftedNow(-2, "day")})`);
    await storage.execute("INSERT INTO demo_dates (id, at) VALUES ('bound', ?)", storage.sql.dateParam(new Date(before - 1_000)));
    const rows = await storage.query<{ id: string; at: number; kind: string }>(
      "SELECT id, at, typeof(at) AS kind FROM demo_dates ORDER BY at",
    );
    expect(rows.map((r) => r.kind)).toEqual(["integer", "integer", "integer"]);
    expect(rows.map((r) => r.id)).toEqual(["past", "bound", "now"]);
    expect(Math.abs(rows[2].at - before)).toBeLessThan(5_000);
    const recent = await storage.query(`SELECT id FROM demo_dates WHERE at >= ${storage.sql.startOfToday()} ORDER BY id`);
    expect(recent).toEqual([{ id: "bound" }, { id: "now" }]);
  });

  it("upsert : « maintenant » sur conflit, et relecture d'une date", async () => {
    await storage.migrate([dated]);
    const upsert = storage.sql.upsert({ table: "demo_dates", columns: ["id", "at"], conflict: ["id"], update: [["at", "now"]] });
    await storage.execute(upsert, "x", 0);
    await storage.execute(upsert, "x", 0);
    const [row] = await storage.query<{ at: number }>("SELECT at FROM demo_dates");
    expect(storage.sql.readDate(row.at)!.getTime()).toBeGreaterThan(0);
  });

  it("une trace de migration est datée en entier", async () => {
    await storage.migrate([dated]);
    expect(await storage.query("SELECT typeof(appliedAt) AS kind FROM plugin_migrations")).toEqual([{ kind: "integer" }]);
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
      pluginId: "autre", executor: sqliteExecutor(db),
    });
    expect(await other.migrate([createTable])).toEqual([1]);
  });

  it("refuse une version invalide ou en double", async () => {
    await expect(storage.migrate([{ ...createTable, version: 0 }])).rejects.toThrow(/invalide/);
    await expect(storage.migrate([createTable, createTable])).rejects.toThrow(/en double/);
  });
});
