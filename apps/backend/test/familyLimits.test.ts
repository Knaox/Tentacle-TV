/**
 * Le périmètre d'une session de profil et l'invisibilité des invités :
 * une session de profil regarde mais n'administre rien (ni push, ni
 * téléchargements) ; un invité n'a ni Watch Together, ni tickets, ni Vigie
 * (un MEMBRE garde Vigie) ; et aucune liste de comptes ne le montre
 * (SEC-F-21) — seules les sessions en cours l'étiquettent.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, enroll, openProfile, pairTv, resetCaches, seedUsers } from "./familyHarness";
import { requireAdmin } from "../src/middleware/auth";
import { adminUsersRoutes } from "../src/routes/adminUsers";
import { watchTogetherUsersRoutes } from "../src/routes/watchTogetherUsers";
import { buildSnapshot } from "../src/services/adminSessions/snapshot";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildFamilyApp(async (fastify) => {
    await fastify.register(watchTogetherUsersRoutes, { prefix: "/api/watch-together" });
    await fastify.register(async (admin) => {
      admin.addHook("preHandler", requireAdmin);
      await admin.register(adminUsersRoutes);
    }, { prefix: "/api/admin" });
  });
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  h.state = freshState();
  h.fetch = fakeJellyfinUsersFetch(h.state.jf);
  resetCaches();
  tokens = seedUsers(h.state);
});

const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });

async function sessions(): Promise<{ owner: string; guest: string; guestId: string; member: string }> {
  const guest = await app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(tokens.damien), payload: { name: "Zoé", color: "pink" } });
  const guestId = guest.json().userId as string;
  const id = (await app.inject({ method: "POST", url: "/api/family/invitations", headers: bearer(tokens.damien), payload: { userId: IDS.lea } })).json().id;
  await app.inject({ method: "POST", url: "/api/family/invitations/accept", headers: bearer(tokens.lea), payload: { id } });
  const salon = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const chambre = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const bureau = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  return {
    owner: (await openProfile(app, salon, { profileId: IDS.damien })).json().token,
    guest: (await openProfile(app, chambre, { profileId: guestId })).json().token,
    guestId,
    member: (await openProfile(app, bureau, { profileId: IDS.lea })).json().token,
  };
}

describe("le périmètre d'une session de profil", () => {
  it("regarde, mais n'a ni push ni téléchargements — quel que soit le profil", async () => {
    const s = await sessions();
    for (const token of [s.owner, s.member, s.guest]) {
      expect((await get("/api/protected", token)).statusCode).toBe(200);
      for (const door of ["/api/push/register", "/api/downloads/capabilities"]) {
        const res = await get(door, token);
        expect(res.statusCode).toBe(403);
        expect(res.json().code).toBe("family.personal_session_required");
      }
    }
  });

  it("un invité n'a ni Watch Together, ni tickets, ni Vigie ; un membre garde tout cela", async () => {
    const s = await sessions();
    for (const door of ["/api/watch-together/group", "/api/tickets/mine", "/api/plugins/seer/requests"]) {
      const asGuest = await get(door, s.guest);
      expect(asGuest.statusCode).toBe(403);
      expect(asGuest.json().code).toBe("family.guest_account");
      expect((await get(door, s.member)).statusCode).toBe(200);
      expect((await get(door, s.owner)).statusCode).toBe(200);
    }
  });
});

describe("un invité n'apparaît dans aucune liste", () => {
  it("ni chez Watch Together, ni dans l'administration", async () => {
    const { guestId } = await sessions();
    const wt = (await get("/api/watch-together/users", tokens.hugo)).json().map((u: { id: string }) => u.id);
    expect(wt).toContain(IDS.damien);
    expect(wt).not.toContain(guestId);
    const admin = await get("/api/admin/users", tokens.damien);
    expect(admin.statusCode).toBe(200);
    const listed = JSON.stringify(admin.json());
    expect(listed).toContain(IDS.lea);
    expect(listed).not.toContain(guestId);
  });

  it("seules les sessions en cours le montrent, étiqueté du nom de son propriétaire", () => {
    const raw = [
      { Id: "s1", UserId: "AB-CD", UserName: "Zoe - invite de Damien", LastActivityDate: new Date().toISOString(), NowPlayingItem: { Id: "i", Name: "Film" } },
      { Id: "s2", UserId: IDS.lea, UserName: "Léa", LastActivityDate: new Date().toISOString(), NowPlayingItem: { Id: "j", Name: "Série" } },
    ];
    const snap = buildSnapshot({ raw, receivedAt: Date.now(), connections: [], rooms: [], now: Date.now(), familyGuests: new Map([["abcd", "Damien"]]) });
    expect(new Map(snap.sessions.map((s) => [s.userId, s.familyGuestOf]))).toEqual(new Map([["AB-CD", "Damien"], [IDS.lea, null]]));
  });
});
