import { performance } from "perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/**
 * Le banc des écrivains simultanés (docs/sqlite/DECISION.md § 1 et § 5) : ce
 * que fait un serveur chargé, dans un seul processus et sur une seule
 * connexion — aucun SQLITE_BUSY, aucun P1008/P2028 ne doit remonter.
 *
 *  - le worker de Vigie : SQL BRUT sur ses tables (`seer_*`), quatre à la fois
 *    (`mapLimit` 4), lecture puis écriture, et ses revendications de contenu ;
 *  - la reco : remplacement de rangées en transaction interactive ;
 *  - les sockets : progression de lecture et notifications, au fil de l'eau ;
 *  - une longue lecture en même temps (la page d'accueil, l'admin).
 */
let db: TestPrisma;
beforeAll(async () => {
  db = await openTestPrisma();
  // Une table d'extension, comme Vigie la crée (hors du schéma du cœur).
  await db.prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS seer_requests (id TEXT PRIMARY KEY, tmdb_id INTEGER NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  );
});
afterAll(async () => {
  await db.close();
});

async function mapLimit<T>(items: T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
}

describe("écrivains simultanés sur la connexion unique", () => {
  it("Vigie, reco, sockets et une longue lecture : aucun échec, latence bornée", async () => {
    const prisma = db.prisma;
    const errors: string[] = [];
    const latencies: number[] = [];
    const timed = async (what: string, run: () => Promise<unknown>): Promise<void> => {
      const start = performance.now();
      try {
        await run();
      } catch (error) {
        errors.push(`${what}: ${(error as { code?: string }).code ?? ""} ${String((error as Error).message).split("\n").pop()}`);
      } finally {
        latencies.push(performance.now() - start);
      }
    };

    const vigie = mapLimit(Array.from({ length: 300 }, (_, i) => i), 4, (i) =>
      timed("vigie", async () => {
        const now = Date.now();
        await prisma.$queryRawUnsafe(`SELECT status FROM seer_requests WHERE id = ?`, `r${i % 50}`);
        await prisma.$executeRawUnsafe(
          `INSERT INTO seer_requests (id, tmdb_id, status, updated_at) VALUES (?, ?, 'pending', ?)
           ON CONFLICT (id) DO UPDATE SET status = 'available', updated_at = excluded.updated_at`,
          `r${i % 50}`,
          1000 + (i % 50),
          now,
        );
        await prisma.contentClaim.upsert({
          where: { tmdbId_jellyfinUserId: { jellyfinUserId: `u${i % 5}`, tmdbId: 1000 + (i % 50) } },
          create: { jellyfinUserId: `u${i % 5}`, tmdbId: 1000 + (i % 50), mediaType: "movie", title: "Titre", expiresAt: new Date(now + 60_000) },
          update: { expiresAt: new Date(now + 60_000) },
        });
      }),
    );
    const reco = Promise.all(Array.from({ length: 40 }, (_, i) =>
      timed("reco", () =>
        prisma.$transaction(async (tx) => {
          await tx.recommendationCache.deleteMany({ where: { jellyfinUserId: `u${i % 5}`, rowKey: "forYou" } });
          await tx.recommendationCache.create({ data: { jellyfinUserId: `u${i % 5}`, rowKey: "forYou", payload: "x".repeat(50_000), expiresAt: new Date(Date.now() + 3_600_000) } });
        }),
      ),
    ));
    const sockets = Promise.all(Array.from({ length: 400 }, (_, i) =>
      timed("socket", () =>
        i % 2
          ? prisma.notification.create({ data: { jellyfinUserId: `u${i % 5}`, type: "ticket_reply", title: "t", body: "b" } })
          : prisma.watchSegment.create({
              data: { jellyfinUserId: `u${i % 5}`, sessionKey: `s${i}`, itemId: "i", itemType: "Movie", itemName: "Film", startedAt: new Date(), lastSeenAt: new Date() },
            }),
      ),
    ));
    const reads = Promise.all(Array.from({ length: 20 }, () =>
      timed("lecture", () => prisma.recommendationCache.findMany({ orderBy: { generatedAt: "desc" } })),
    ));
    await Promise.all([vigie, reco, sockets, reads]);

    expect(errors).toEqual([]);
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    // Mesuré ~quelques dizaines de ms ; la borne dit « jamais l'attente de 2 s du maxWait par défaut ».
    expect(p99).toBeLessThan(2_000);
    expect(Number((await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM seer_requests`))[0].n)).toBe(50);
    expect(await prisma.notification.count()).toBe(200);
  }, 60_000);
});
