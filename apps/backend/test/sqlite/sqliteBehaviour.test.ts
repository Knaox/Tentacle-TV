import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/**
 * Ce que la base doit tenir, sur une VRAIE SQLite réglée comme en production
 * (une connexion, WAL, clés étrangères) : texte long, unicode, cascade,
 * restriction, et écritures concurrentes sans un seul échec.
 */
let db: TestPrisma;
beforeAll(async () => {
  db = await openTestPrisma();
});
afterAll(async () => {
  await db.close();
});

const ticket = (id: string) => ({ id, jellyfinUserId: "u", username: "n", subject: "s" });

describe("SQLite réglée comme en production", () => {
  it("PRAGMA de la connexion : WAL, clés étrangères, synchronous NORMAL, busy_timeout 15 s", async () => {
    const one = async (pragma: string) => Object.values((await db.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`PRAGMA ${pragma}`))[0])[0];
    expect(await one("journal_mode")).toBe("wal");
    expect(Number(await one("foreign_keys"))).toBe(1);
    expect(Number(await one("synchronous"))).toBe(1);
    expect(Number(await one("busy_timeout"))).toBe(15_000);
  });

  it("texte long (≈ 7 Mo) et unicode, émojis composés compris, rendus à l'identique", async () => {
    const body = "🐙 é ü 漢字 ".repeat(400_000);
    const subject = "👨‍👩‍👧 Famille — « ça marche »";
    await db.prisma.supportTicket.create({ data: { ...ticket("long"), subject, messages: { create: [{ id: "m-long", jellyfinUserId: "u", username: "n", body }] } } });
    expect((await db.prisma.ticketMessage.findUnique({ where: { id: "m-long" } }))?.body).toBe(body);
    expect((await db.prisma.supportTicket.findUnique({ where: { id: "long" } }))?.subject).toBe(subject);
  });

  it("onDelete: Cascade emporte les messages ; une clé étrangère sans cascade refuse la suppression", async () => {
    await db.prisma.supportTicket.create({ data: { ...ticket("cascade"), messages: { create: [{ jellyfinUserId: "u", username: "n", body: "x" }] } } });
    await db.prisma.supportTicket.delete({ where: { id: "cascade" } });
    expect(await db.prisma.ticketMessage.count({ where: { ticketId: "cascade" } })).toBe(0);

    const key = await db.prisma.inviteKey.create({ data: { key: "fk" } });
    await db.prisma.inviteUsage.create({ data: { inviteKeyId: key.id, jellyfinUserId: "u", username: "n" } });
    await expect(db.prisma.inviteKey.delete({ where: { id: key.id } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("unicité : P2002, avec les CHAMPS en cause (MariaDB donnait le nom de l'index)", async () => {
    await db.prisma.inviteKey.create({ data: { key: "dup" } });
    await expect(db.prisma.inviteKey.create({ data: { key: "dup" } })).rejects.toMatchObject({ code: "P2002", meta: { target: ["key"] } });
  });

  it("écritures concurrentes : 64 transactions lire-puis-écrire et 400 écritures, aucun échec", async () => {
    await db.prisma.supportTicket.create({ data: ticket("hot") });
    const errors: unknown[] = [];
    const transactions = Array.from({ length: 64 }, (_, i) =>
      db.prisma
        .$transaction(async (tx) => {
          const n = await tx.supportTicket.count();
          await tx.supportTicket.create({ data: { ...ticket(`c${i}`), subject: String(n) } });
          await tx.supportTicket.update({ where: { id: "hot" }, data: { subject: String(i) } });
        })
        .catch((error: unknown) => errors.push(error)),
    );
    const writes = Array.from({ length: 400 }, (_, i) =>
      db.prisma.ticketMessage.create({ data: { ticketId: "hot", jellyfinUserId: "u", username: "n", body: String(i) } }).catch((error: unknown) => errors.push(error)),
    );
    await Promise.all([...transactions, ...writes]);
    expect(errors).toEqual([]);
    expect(await db.prisma.ticketMessage.count({ where: { ticketId: "hot" } })).toBe(400);
    expect(await db.prisma.supportTicket.count({ where: { id: { startsWith: "c" } } })).toBe(64);
  });

  it("isolation : une écriture lancée PENDANT une transaction annulée survit (attend son tour)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tx = db.prisma
      .$transaction(async (t) => {
        await t.supportTicket.create({ data: ticket("in-tx") });
        await gate;
        throw new Error("annulée");
      })
      .catch(() => "annulée");
    await new Promise((resolve) => setTimeout(resolve, 30));
    const outside = db.prisma.supportTicket.create({ data: ticket("outside") });
    release();
    expect(await tx).toBe("annulée");
    await outside;
    expect(await db.prisma.supportTicket.findUnique({ where: { id: "in-tx" } })).toBeNull();
    expect(await db.prisma.supportTicket.findUnique({ where: { id: "outside" } })).not.toBeNull();
  });
});
