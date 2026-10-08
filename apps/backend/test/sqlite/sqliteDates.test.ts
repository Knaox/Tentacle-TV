import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/**
 * Le format des DateTime, FIGÉ (docs/sqlite/DECISION.md § 2) : un INTEGER en
 * millisecondes depuis 1970, quelle que soit la forme d'écriture. Un TEXT
 * serait toujours « plus grand » qu'un entier et fausserait les comparaisons.
 */
const { holder } = vi.hoisted(() => ({ holder: {} as { db?: TestPrisma } }));
vi.mock("../../src/services/db", () => ({ getPrisma: () => holder.db!.prisma, hasPrisma: () => true }));

import { sweepOrphans } from "../../src/services/watchTime/store";

beforeAll(async () => {
  holder.db = await openTestPrisma();
});
afterAll(async () => {
  await holder.db?.close();
});

const AT = new Date("2026-10-08T12:34:56.789Z");
/**
 * `typeof()` et valeur STOCKÉE, lus en SQL brut par la même connexion — jamais
 * par `node:sqlite` pendant que Prisma tient le fichier (DECISION.md § 8).
 */
async function stored(sql: string): Promise<Array<Record<string, unknown>>> {
  const rows = await holder.db!.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));
}

describe("DateTime en SQLite : des millisecondes entières, partout", () => {
  it("create, @default(now()), @updatedAt, createMany, upsert, update", async () => {
    const prisma = holder.db!.prisma;
    await prisma.inviteKey.create({ data: { id: "k1", key: "k1", expiresAt: AT } });
    await prisma.inviteKey.createMany({ data: [{ id: "k2", key: "k2", expiresAt: AT }] });
    await prisma.inviteKey.upsert({ where: { key: "k3" }, create: { id: "k3", key: "k3", expiresAt: AT }, update: {} });
    await prisma.supportTicket.create({ data: { id: "t1", jellyfinUserId: "u", username: "n", subject: "s" } });
    await prisma.supportTicket.update({ where: { id: "t1" }, data: { subject: "s2" } });
    for (const row of await stored(`SELECT typeof("createdAt") AS c, typeof("expiresAt") AS e, "expiresAt" + 0 AS v FROM "invite_keys" ORDER BY "id"`)) {
      expect(row).toEqual({ c: "integer", e: "integer", v: AT.getTime() });
    }
    expect(await stored(`SELECT typeof("createdAt") AS c, typeof("updatedAt") AS u FROM "support_tickets"`)).toEqual([{ c: "integer", u: "integer" }]);
  });

  it("une Date liée en SQL brut est le même entier, et se compare juste", async () => {
    const prisma = holder.db!.prisma;
    const [row] = await prisma.$queryRaw<Array<{ v: bigint; t: string }>>`SELECT ${AT} AS v, typeof(${AT}) AS t`;
    expect(row.t).toBe("integer");
    expect(Number(row.v)).toBe(AT.getTime());
    const later = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "invite_keys" WHERE "expiresAt" >= ${AT} ORDER BY "id"`;
    expect(later.map((r) => r.id)).toEqual(["k1", "k2", "k3"]);
    // Relu par Prisma : une vraie Date, à la milliseconde.
    expect((await prisma.inviteKey.findUnique({ where: { id: "k1" } }))?.expiresAt?.toISOString()).toBe(AT.toISOString());
  });

  it("un COUNT(*) brut revient en bigint : Number() avant de répondre", async () => {
    const [row] = await holder.db!.prisma.$queryRaw<Array<{ n: unknown }>>`SELECT COUNT(*) AS n FROM "invite_keys"`;
    expect(typeof row.n).toBe("bigint");
    expect(Number(row.n)).toBe(3);
  });

  it("pourquoi un seul format : une date en TEXTE passe pour plus récente que tout entier", async () => {
    await holder.db!.prisma.$executeRawUnsafe(`INSERT INTO "invite_keys" ("id", "key", "createdAt") VALUES ('old', 'old', '2000-01-01 00:00:00')`);
    const wrong = await holder.db!.prisma.inviteKey.findMany({ where: { id: "old", createdAt: { gt: new Date("2026-01-01") } } });
    expect(wrong).toHaveLength(1);
    await holder.db!.prisma.inviteKey.delete({ where: { id: "old" } });
  });

  it("temps de visionnage : les segments orphelins se ferment à leur dernier relevé, comparé en entiers", async () => {
    const prisma = holder.db!.prisma;
    const base = { jellyfinUserId: "u", sessionKey: "s", itemId: "i", itemType: "Movie", itemName: "Film" };
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.watchSegment.create({ data: { ...base, id: "w-old", startedAt: old, lastSeenAt: old } });
    await prisma.watchSegment.create({ data: { ...base, id: "w-live", startedAt: new Date(), lastSeenAt: new Date() } });
    expect(await sweepOrphans()).toBe(1);
    // `+ 0` : la valeur stockée, pas la Date que le moteur tire d'une colonne DATETIME.
    const rows = await stored(`SELECT "id", typeof("closedAt") AS t, "closedAt" + 0 AS closed, "lastSeenAt" + 0 AS seen FROM "watch_segments" ORDER BY "id"`);
    expect(rows.map((r) => [r.id, r.t])).toEqual([["w-live", "null"], ["w-old", "integer"]]);
    expect(Number(rows[1].closed)).toBe(old.getTime());
    expect(Number(rows[1].closed)).toBe(Number(rows[1].seen));
  });

  it("piège du SQL brut : une expression sans type déclaré prend le type de sa PREMIÈRE ligne", async () => {
    // Première ligne NULL : le moteur rend les suivantes en TEXTE. D'où la règle :
    // Number() / String() explicites sur tout ce qu'un SQL brut calcule.
    const rows = await holder.db!.prisma.$queryRawUnsafe<Array<{ v: unknown }>>(
      `SELECT "closedAt" + 0 AS v FROM "watch_segments" ORDER BY "id"`,
    );
    expect(rows[0].v).toBeNull();
    expect(typeof rows[1].v).toBe("string");
  });

  it("aucun INSERT en SQL brut dans le cœur : s'il en vient un, il nommera ses colonnes de date", () => {
    // Le DDL garde DEFAULT CURRENT_TIMESTAMP (texte) : un INSERT brut qui omet
    // une date écrirait du TEXTE. Ce test oblige à relire la règle § 2.
    const src = resolve(__dirname, "../../src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(path);
      }
    };
    walk(src);
    const offenders = files.filter((file) => /(queryRaw|executeRaw)[\s\S]{0,200}?\bINSERT\s+INTO/i.test(readFileSync(file, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
