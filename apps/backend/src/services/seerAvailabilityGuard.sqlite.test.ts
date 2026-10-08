import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openTestDatabase, type TestDatabase } from "./pluginStorage/sqliteTestExecutor";
import { resolveSeerContent } from "./seerAvailabilityGuard";

/*
 * Le cœur lit `seer_requests` (table de Vigie) par l'identifiant d'une
 * demande, que Vigie pose en `refId` de ses notifications : un UUID, en
 * chaîne. Sur une vraie SQLite, avec la forme que la copie depuis MariaDB
 * donne à la table (docs/sqlite/GENERIC-COPY.md : `id` TEXT, `tmdb_id`
 * INTEGER) : la chaîne retrouve sa ligne, l'entier revient en nombre, et une
 * table absente retombe sur les claims, sans erreur.
 */

const holder = vi.hoisted(() => ({ db: null as TestDatabase | null }));

vi.mock("./db", () => ({
  getPrisma: () => ({
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => holder.db!.prepare(sql).all(...params),
  }),
}));

const UUID = "3f0c2a9e-6b1d-4c8e-9f3a-2b7d5e1c0a44";

let db: TestDatabase;

beforeEach(() => {
  db = openTestDatabase();
  holder.db = db;
});
afterEach(() => db.close());

function copiedSeerRequests(): void {
  db.exec(`CREATE TABLE "seer_requests" ("id" TEXT NOT NULL, "media_type" TEXT NOT NULL, "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL, "created_at" DATETIME NOT NULL, PRIMARY KEY ("id"))`);
  db.prepare("INSERT INTO seer_requests (id, media_type, tmdb_id, title, created_at) VALUES (?, 'tv', 1399, 'Une série', ?)")
    .run(UUID, Date.now());
  // Un identifiant d'apparence numérique reste du texte : une colonne TEXT ne le convertit pas.
  db.prepare("INSERT INTO seer_requests (id, media_type, tmdb_id, title, created_at) VALUES ('123', 'movie', 603, 'Un film', ?)")
    .run(Date.now());
}

describe("resolveSeerContent sur la forme SQLite de seer_requests", () => {
  it("le refId en chaîne retrouve sa demande, tmdb_id revient en nombre", async () => {
    copiedSeerRequests();
    expect(await resolveSeerContent({ refId: UUID, title: "Une série" }, [])).toEqual({ tmdbId: 1399, mediaType: "tv", title: "Une série" });
    expect(await resolveSeerContent({ refId: "123", title: "Un film" }, [])).toEqual({ tmdbId: 603, mediaType: "movie", title: "Un film" });
  });

  it("une table absente retombe sur les claims, sans erreur", async () => {
    const claim = { tmdbId: 7, mediaType: "movie" as const, title: "Un film" };
    expect(await resolveSeerContent({ refId: UUID, title: "Un film" }, [claim])).toEqual(claim);
  });
});
