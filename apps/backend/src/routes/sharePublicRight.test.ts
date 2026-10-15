/**
 * Le droit « Partage public » (`EnablePublicSharing` de Jellyfin) sur les liens
 * de Ma liste et des favoris : pas de lien créé sans lui, et un lien existant
 * dit « indisponible » tant que son propriétaire ne l'a pas — puis revient.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { token: string; ownerUserId: string; ownerUsername: string; kind: string }
const rows: Row[] = [];
const denied = new Set<string>();

const pick = (row: Row, select?: Record<string, boolean>) =>
  select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k as keyof Row]])) : row;

vi.mock("../services/db", () => ({
  getPrisma: () => ({
    shareLink: {
      upsert: async ({ create, select }: { create: Row; select?: Record<string, boolean> }) => {
        const found = rows.find((r) => r.ownerUserId === create.ownerUserId && r.kind === create.kind);
        if (!found) rows.push(create);
        return pick(found ?? create, select);
      },
      findUnique: async ({ where, select }: { where: { token?: string; ownerUserId_kind?: { ownerUserId: string; kind: string } }; select?: Record<string, boolean> }) => {
        const found = rows.find((r) => (where.token ? r.token === where.token
          : r.ownerUserId === where.ownerUserId_kind?.ownerUserId && r.kind === where.ownerUserId_kind?.kind));
        return found ? pick(found, select) : null;
      },
      deleteMany: async () => ({ count: 0 }),
    },
  }),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, string>; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const id = request.headers["x-test-user"];
    if (!id) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: id, username: id, isAdmin: false };
  },
}));

vi.mock("../services/share/publicSharingRight", () => ({ mayShareInPublic: async (userId: string) => !denied.has(userId) }));
vi.mock("../services/shareLists", () => ({
  sharedListEntries: async () => [{ Id: "w1", Name: "Alien", Type: "Movie", InLibrary: true }],
}));
vi.mock("../services/jellyfin", () => ({ getItemDetail: async (_user: string, itemId: string) => ({ Id: itemId, Name: "Alien" }) }));
vi.mock("./shareStats", () => ({
  registerStatsOwnerRoutes: () => undefined,
  replySharedStats: async () => ({ kind: "stats" }),
  sharedStatsShowsTitle: async () => false,
}));

import { shareRoutes } from "./share";

async function makeApp() {
  const app = Fastify();
  await app.register(shareRoutes, { prefix: "/api/share" });
  return app;
}

const as = (user: string) => ({ "x-test-user": user });

beforeEach(() => {
  rows.length = 0;
  denied.clear();
});

describe("le droit « Partage public »", () => {
  it("dit au compte s'il peut partager", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/share/access", headers: as("u1") })).json()).toEqual({ publicSharing: true });
    denied.add("u1");
    expect((await app.inject({ method: "GET", url: "/api/share/access", headers: as("u1") })).json()).toEqual({ publicSharing: false });
    expect((await app.inject({ method: "GET", url: "/api/share/access" })).statusCode).toBe(401);
  });

  it("refuse de créer un lien de Ma liste ou des favoris sans le droit", async () => {
    const app = await makeApp();
    denied.add("u1");
    for (const url of ["/api/share/", "/api/share/likes/"]) {
      const res = await app.inject({ method: "POST", url, headers: as("u1") });
      expect([res.statusCode, res.json().error]).toEqual([403, "public_sharing_denied"]);
    }
    expect(rows).toEqual([]);
    const ok = await app.inject({ method: "POST", url: "/api/share/", headers: as("u2") });
    expect(ok.statusCode).toBe(200);
    expect(rows).toHaveLength(1);
  });

  it("un lien existant dit « indisponible » sans le droit, puis revient avec lui", async () => {
    const app = await makeApp();
    const { token } = (await app.inject({ method: "POST", url: "/api/share/likes/", headers: as("u1") })).json();
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).json()).toMatchObject({ kind: "likes", items: [{ Id: "w1" }] });

    denied.add("u1");
    for (const url of [`/api/share/${token}`, `/api/share/${token}/item/w1`]) {
      const res = await app.inject({ method: "GET", url });
      expect([res.statusCode, res.json().error]).toEqual([403, "share_unavailable"]);
      expect(JSON.stringify(res.json())).not.toContain("Alien");
    }
    expect(rows).toHaveLength(1);

    denied.delete("u1");
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/share/${token}/item/w1` })).json()).toMatchObject({ Id: "w1" });
  });

  it("un jeton inconnu reste « introuvable », jamais « indisponible »", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/share/inconnu" })).statusCode).toBe(404);
  });
});
