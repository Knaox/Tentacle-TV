/**
 * « Accès à Octave » par l'administration : session personnelle exigée, corps
 * strict, défaut permis, un invité de la Famille suit son créateur (il ne se
 * règle pas), et un changement prévient le compte ET ses invités. La base est
 * un faux Prisma en mémoire ; le service (`octaveAccess.ts`) est le vrai.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ALICE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GUEST = "cccccccccccccccccccccccccccccccc";
const OLD_GUEST = "dddddddddddddddddddddddddddddddd";

const state = vi.hoisted(() => ({
  personal: true,
  down: false,
  dbDown: false,
  rights: new Map<string, { userId: string; access: boolean }>(),
  members: [] as { userId: string; kind: string; familyId: string; createdBy: string | null }[],
  families: [] as { id: string; ownerUserId: string }[],
  sent: [] as { userIds: string[]; type: string }[],
  forgotten: 0,
}));

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../middleware/auth", () => ({
  requirePersonalAdmin: async (request: { user?: unknown }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    if (!state.personal) return reply.status(403).send({ message: "Forbidden" });
    request.user = { userId: ADMIN, username: "Admin", isAdmin: true, session: "personal" };
  },
}));
vi.mock("../services/watchTogether/usersCache", () => ({
  getJellyfinUsers: async () => (state.down ? null : [ADMIN, ALICE, GUEST, OLD_GUEST].map((id) => ({ id, name: id.slice(0, 4) }))),
  invalidateJellyfinUsers: () => undefined,
}));
vi.mock("../plugins/runtime/accountRights", () => ({ forgetIsolatedRights: () => void state.forgotten++ }));
vi.mock("../music/events/musicSend", () => ({
  sendMusicEvent: (userIds: string[], event: { type: string }) => {
    state.sent.push({ userIds, type: event.type });
    return userIds.length;
  },
}));
vi.mock("../services/db", () => {
  const guard = () => {
    if (state.dbDown) throw new Error("base muette");
  };
  return {
    hasPrisma: () => true,
    getPrisma: () => ({
      octaveAccountRights: {
        findUnique: async ({ where }: { where: { userId: string } }) => (guard(), state.rights.get(where.userId) ?? null),
        upsert: async ({ where, create, update }: { where: { userId: string }; create: { userId: string; access: boolean }; update: { access: boolean } }) => {
          guard();
          const next = state.rights.has(where.userId) ? { userId: where.userId, ...update } : create;
          state.rights.set(where.userId, next);
          return next;
        },
      },
      familyMember: {
        findUnique: async ({ where }: { where: { userId: string } }) => (guard(), state.members.find((m) => m.userId === where.userId) ?? null),
        findMany: async ({ where }: { where: { kind: string } }) => state.members.filter((m) => m.kind === where.kind),
      },
      family: {
        findUnique: async ({ where }: { where: { id: string } }) => state.families.find((f) => f.id === where.id) ?? null,
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => state.families.filter((f) => where.id.in.includes(f.id)),
      },
    }),
  };
});

import { adminOctaveRightsRoutes } from "./adminOctaveRights";
import { hasOctaveAccess, resetOctaveAccessForTests } from "../services/octaveRights/octaveAccess";

async function app() {
  const server = Fastify();
  await server.register(adminOctaveRightsRoutes, { prefix: "/api/admin" });
  return server;
}

beforeEach(() => {
  state.personal = true;
  state.down = false;
  state.dbDown = false;
  state.rights.clear();
  state.sent.length = 0;
  state.forgotten = 0;
  state.families = [{ id: "fam", ownerUserId: ADMIN }];
  state.members = [
    { userId: ADMIN, kind: "owner", familyId: "fam", createdBy: null },
    { userId: ALICE, kind: "member", familyId: "fam", createdBy: null },
    { userId: GUEST, kind: "guest", familyId: "fam", createdBy: ALICE },
    { userId: OLD_GUEST, kind: "guest", familyId: "fam", createdBy: null },
  ];
  resetOctaveAccessForTests();
});

describe("GET/PUT /api/admin/users/:userId/octave", () => {
  it("allumé par défaut : un compte sans ligne a l'accès", async () => {
    const server = await app();
    const response = await server.inject({ method: "GET", url: `/api/admin/users/${ALICE}/octave` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: ALICE, access: true });
    expect(await hasOctaveAccess(ALICE)).toBe(true);
  });

  it("couper : gardé, relu, l'extension se relit, le compte et SES invités sont prévenus", async () => {
    const server = await app();
    const response = await server.inject({ method: "PUT", url: `/api/admin/users/${ALICE}/octave`, payload: { access: false } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: ALICE, access: false });
    expect(state.rights.get(ALICE)).toEqual({ userId: ALICE, access: false });
    expect(await hasOctaveAccess(ALICE)).toBe(false);
    expect(state.forgotten).toBe(1);
    expect(state.sent).toEqual([{ userIds: [ALICE, GUEST], type: "music:provider" }]);
    // L'invité suit son créateur ; celui d'avant la v2 (sans créateur) suit le propriétaire.
    expect(await hasOctaveAccess(GUEST)).toBe(false);
    expect(await hasOctaveAccess(OLD_GUEST)).toBe(true);
    expect(await hasOctaveAccess(ADMIN)).toBe(true);
  });

  it("le propriétaire coupé : ses invités d'avant la v2 le suivent", async () => {
    const server = await app();
    await server.inject({ method: "PUT", url: `/api/admin/users/${ADMIN}/octave`, payload: { access: false } });
    expect(await hasOctaveAccess(OLD_GUEST)).toBe(false);
    expect(await hasOctaveAccess(GUEST)).toBe(true);
    expect(state.sent[0]?.userIds).toEqual([ADMIN, OLD_GUEST]);
  });

  it("un invité de la Famille ne se règle pas (409 family_guest)", async () => {
    const server = await app();
    expect((await server.inject({ method: "GET", url: `/api/admin/users/${GUEST}/octave` })).json()).toEqual({ error: "family_guest" });
    const put = await server.inject({ method: "PUT", url: `/api/admin/users/${GUEST}/octave`, payload: { access: false } });
    expect(put.statusCode).toBe(409);
    expect(state.rights.size).toBe(0);
  });

  it("refus du contrat : corps invalide, compte inconnu, Jellyfin muet", async () => {
    const server = await app();
    for (const payload of [{}, { access: "non" }, { access: false, extra: 1 }]) {
      const response = await server.inject({ method: "PUT", url: `/api/admin/users/${ALICE}/octave`, payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "invalid_value" });
    }
    const unknown = "e".repeat(32);
    expect((await server.inject({ method: "GET", url: `/api/admin/users/${unknown}/octave` })).statusCode).toBe(404);
    expect((await server.inject({ method: "GET", url: "/api/admin/users/pas-un-id/octave" })).statusCode).toBe(404);
    state.down = true;
    expect((await server.inject({ method: "PUT", url: `/api/admin/users/${ALICE}/octave`, payload: { access: false } })).statusCode).toBe(503);
    expect(state.rights.size).toBe(0);
  });

  it("jamais hors d'une session personnelle d'administrateur", async () => {
    state.personal = false;
    const server = await app();
    expect((await server.inject({ method: "PUT", url: `/api/admin/users/${ALICE}/octave`, payload: { access: false } })).statusCode).toBe(403);
    expect(state.rights.size).toBe(0);
  });
});

describe("hasOctaveAccess — base muette", () => {
  it("fermé à l'échec", async () => {
    state.dbDown = true;
    expect(await hasOctaveAccess(ALICE)).toBe(false);
  });
});
