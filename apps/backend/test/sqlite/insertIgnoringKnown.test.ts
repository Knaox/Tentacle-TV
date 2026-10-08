import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/**
 * Les anciens `createMany({ skipDuplicates: true })` (refusés par SQLite),
 * éprouvés sur une vraie base : une ligne connue garde la sienne, les neuves
 * entrent, rien ne lève.
 */
const { holder } = vi.hoisted(() => ({ holder: {} as { db?: TestPrisma } }));
vi.mock("../../src/services/db", () => ({ getPrisma: () => holder.db!.prisma, hasPrisma: () => true }));

import { recordAnnounced } from "../../src/services/announcedRegistry";
import { recordArrivals } from "../../src/services/libraryPresence";

beforeAll(async () => {
  holder.db = await openTestPrisma();
});
afterAll(async () => {
  await holder.db?.close();
});

describe("insertions qui ignorent les lignes connues", () => {
  it("registre des annonces : une clé déjà annoncée garde sa date", async () => {
    const prisma = holder.db!.prisma;
    const old = new Date("2026-01-01T00:00:00.000Z");
    await prisma.announcedContent.create({ data: { contentKey: "movie:1", jellyfinUserId: "u1", notifiedAt: old } });
    await recordAnnounced("u1", ["movie:1", "movie:2", "movie:2"]);
    const rows = await prisma.announcedContent.findMany({ orderBy: { contentKey: "asc" } });
    expect(rows.map((row) => row.contentKey)).toEqual(["movie:1", "movie:2"]);
    expect(rows[0].notifiedAt.toISOString()).toBe(old.toISOString());
  });

  it("présence en bibliothèque : un ID connu garde sa clé, un ID parti revient", async () => {
    const prisma = holder.db!.prisma;
    await prisma.libraryKnownId.createMany({
      data: [
        { itemId: "a", contentKey: "movie:1" },
        { itemId: "b", contentKey: "movie:2", removedAt: new Date("2026-02-01T00:00:00Z") },
      ],
    });
    await recordArrivals([
      { itemId: "a", contentKey: null },
      { itemId: "b", contentKey: null },
      { itemId: "c", contentKey: null },
      { itemId: "c", contentKey: null },
    ]);
    const rows = await prisma.libraryKnownId.findMany({ orderBy: { itemId: "asc" } });
    expect(rows).toEqual([
      { itemId: "a", contentKey: "movie:1", removedAt: null },
      { itemId: "b", contentKey: "movie:2", removedAt: null },
      { itemId: "c", contentKey: null, removedAt: null },
    ]);
  });
});
