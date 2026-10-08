import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPluginStorage } from "../../src/services/pluginStorage/createPluginStorage";
import { prismaExecutor } from "../../src/services/pluginStorage/prismaExecutor";
import type { PluginMigration, PluginStorage } from "../../src/services/pluginStorage/types";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/*
 * L'interface de stockage des extensions sur une VRAIE base Prisma SQLite,
 * réglée comme en production (migrations du cœur, une connexion, PRAGMA), par
 * l'exécuteur Prisma de production. Ce qu'une extension écrit, le cœur le
 * relit par ses modèles : dates comprises (content_claims de Vigie).
 */

let db: TestPrisma;
let storage: PluginStorage;

beforeEach(async () => {
  db = await openTestPrisma();
  storage = createPluginStorage({ pluginId: "demo", executor: prismaExecutor(db.prisma) });
});
afterEach(async () => db.close());

const items: PluginMigration = {
  version: 1,
  name: "tables",
  up: async (s) => {
    await s.execute("CREATE TABLE demo_items (id TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 0, at DATETIME, PRIMARY KEY (id))");
  },
};

describe("migrations versionnées, notées dans la table du cœur", () => {
  it("une fois chacune ; Prisma relit la trace, datée", async () => {
    const before = Date.now();
    expect(await storage.migrate([items])).toEqual([1]);
    expect(await storage.migrate([items])).toEqual([]);
    const [trace] = await db.prisma.pluginMigration.findMany();
    expect(trace).toMatchObject({ pluginId: "demo", version: 1, name: "tables" });
    expect(trace.appliedAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
  });

  it("une migration qui échoue ne laisse ni table ni trace", async () => {
    const broken: PluginMigration = {
      version: 1, name: "cassée",
      up: async (s) => {
        await s.execute("CREATE TABLE demo_half (id TEXT)");
        await s.execute("CREATE TABLE demo_half (id TEXT)");
      },
    };
    await expect(storage.migrate([broken])).rejects.toThrow(/migration 1 \(cassée\) en échec/);
    expect(await storage.tableExists("demo_half")).toBe(false);
    expect(await db.prisma.pluginMigration.count()).toBe(0);
  });
});

describe("requêtes", () => {
  it("entiers normalisés, upsert, insertIgnore, transaction annulée", async () => {
    await storage.migrate([items]);
    const upsert = storage.sql.upsert({ table: "demo_items", columns: ["id", "hits"], conflict: ["id"], update: ["hits"] });
    await storage.execute(upsert, "a", 1);
    await storage.execute(upsert, "a", 2);
    await storage.execute(`${storage.sql.insertIgnore()} INTO demo_items (id, hits) VALUES (?, ?)`, "a", 9);
    const [row] = await storage.query<{ n: unknown; hits: unknown }>("SELECT COUNT(*) AS n, MAX(hits) AS hits FROM demo_items");
    expect(row).toEqual({ n: 1, hits: 2 });
    await expect(storage.transaction(async (tx) => {
      await tx.execute("INSERT INTO demo_items (id) VALUES (?)", "b");
      throw new Error("panne");
    })).rejects.toThrow("panne");
    expect(await storage.query("SELECT id FROM demo_items ORDER BY id")).toEqual([{ id: "a" }]);
  });

  it("écritures parallèles (worker, écritures de fond) : aucune erreur, rien de perdu", async () => {
    await storage.migrate([items]);
    const insert = storage.sql.upsert({ table: "demo_items", columns: ["id", "hits"], conflict: ["id"], update: ["hits"] });
    await Promise.all([
      ...Array.from({ length: 200 }, (_, i) => storage.execute(insert, `w${i}`, i)),
      ...Array.from({ length: 20 }, (_, i) => storage.transaction(async (tx) => {
        await tx.execute(insert, `t${i}`, i);
        await tx.execute("UPDATE demo_items SET hits = hits + 1 WHERE id = ?", `t${i}`);
      })),
    ]);
    expect(await storage.query("SELECT COUNT(*) AS n FROM demo_items")).toEqual([{ n: 220 }]);
  });
});

describe("dates : ce que l'extension écrit, Prisma le relit et le compare", () => {
  it("maintenant, décalé, lié : des entiers ; relus en Date par le SQL brut de Prisma", async () => {
    await storage.migrate([items]);
    await storage.execute(`INSERT INTO demo_items (id, at) VALUES ('now', ${storage.sql.now()})`);
    await storage.execute(`INSERT INTO demo_items (id, at) VALUES ('old', ${storage.sql.shiftedNow(-3, "day")})`);
    await storage.execute("INSERT INTO demo_items (id, at) VALUES ('bound', ?)", storage.sql.dateParam(new Date(Date.now() - 60_000)));
    const kinds = await storage.query<{ kind: string }>("SELECT DISTINCT typeof(at) AS kind FROM demo_items");
    expect(kinds).toEqual([{ kind: "integer" }]);
    const today = await storage.query(`SELECT id FROM demo_items WHERE at >= ${storage.sql.startOfToday()} ORDER BY id`);
    expect(today.map((r) => r.id)).toContain("now");
    expect(today.map((r) => r.id)).not.toContain("old");
    const [raw] = await storage.query<{ at: unknown }>("SELECT at FROM demo_items WHERE id = 'bound'");
    expect(storage.sql.readDate(raw.at)?.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("content_claims écrit comme Vigie : Prisma le trouve par sa date d'échéance", async () => {
    const write = (tmdbId: number, ttlSeconds: number) => storage.execute(
      storage.sql.upsert({
        table: "content_claims",
        columns: ["tmdbId", "jellyfinUserId", "mediaType", "title", "expiresAt"],
        conflict: ["tmdbId", "jellyfinUserId"],
        update: ["mediaType", "title", "expiresAt"],
      }),
      tmdbId, "u1", "movie", "Un film", storage.sql.dateParam(new Date(Date.now() + ttlSeconds * 1000)),
    );
    await write(603, 1800);
    await write(604, -60);
    const live = await db.prisma.contentClaim.findMany({ where: { expiresAt: { gt: new Date() } } });
    expect(live.map((c) => c.tmdbId)).toEqual([603]);
    await storage.execute(`DELETE FROM content_claims WHERE expiresAt < ${storage.sql.now()}`);
    expect(await db.prisma.contentClaim.count()).toBe(1);
  });
});
