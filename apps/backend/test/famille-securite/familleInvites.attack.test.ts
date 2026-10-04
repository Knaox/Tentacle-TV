/**
 * Tests d'attaque T8 (phase 3) — LES INVITÉS contre l'implémentation de T2 :
 * invisibles de toute liste (SEC-F-21), sans droit ni périmètre d'un compte
 * normal (SEC-F-31), un mot de passe fort que personne ne connaît et qui n'est
 * jamais stocké ni rendu (SEC-F-29).
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("../familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
}));
vi.mock("../../src/services/configStore", async () => (await import("../familyMocks")).configStoreMock(() => h.state!));
vi.mock("../../src/services/db", async () => (await import("../familyMocks")).dbMock(() => h.state!));
vi.mock("../../src/services/wsManager", async () => (await import("../familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../../src/services/pushService", async () => (await import("../familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../../src/services/deviceSessions/deviceAuth", async () => (await import("../familyMocks")).deviceAuthMock());
vi.mock("../../src/services/deviceSessions/gateway", async () => (await import("../familyMocks")).gatewayMock());

import { freshState } from "../familyMocks";
import { fakeJellyfinUsersFetch } from "../fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, enroll, openProfile, pairTv, resetCaches, seedUsers } from "../familyHarness";
import { requireAdmin } from "../../src/middleware/auth";
import { adminUsersRoutes } from "../../src/routes/adminUsers";
import { watchTogetherUsersRoutes } from "../../src/routes/watchTogetherUsers";

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
const addGuest = (name = "Zoé") => app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(tokens.damien), payload: { name, color: "pink" } });

/** Un invité de Damien, plus une session de profil invité et une session de
 *  profil membre (Léa) ouvertes sur deux TV de Damien (une session par TV). */
async function withGuestSession(): Promise<{ guestId: string; guest: string; member: string }> {
  const guestId = (await addGuest()).json().userId as string;
  const id = (await app.inject({ method: "POST", url: "/api/family/invitations", headers: bearer(tokens.damien), payload: { userId: IDS.lea } })).json().id;
  await app.inject({ method: "POST", url: "/api/family/invitations/accept", headers: bearer(tokens.lea), payload: { id } });
  const tvGuest = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const tvMember = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const guest = (await openProfile(app, tvGuest, { profileId: guestId })).json().token as string;
  const member = (await openProfile(app, tvMember, { profileId: IDS.lea })).json().token as string;
  return { guestId, guest, member };
}

describe("SEC-F-21 : un invité n'apparaît dans AUCUNE liste de comptes", () => {
  it("ni chez Watch Together, ni dans l'administration", async () => {
    const guestId = (await addGuest()).json().userId as string;
    const wt = (await get("/api/watch-together/users", tokens.hugo)).json().map((u: { id: string }) => u.id);
    expect(wt).toContain(IDS.damien);
    expect(wt).not.toContain(guestId);
    const admin = await get("/api/admin/users", tokens.damien);
    expect(admin.statusCode).toBe(200);
    const listed = JSON.stringify(admin.json());
    expect(listed).toContain(IDS.lea);
    expect(listed).not.toContain(guestId);
  });
});

describe("SEC-F-31 : un invité est créé sans pouvoir, avec les restrictions du propriétaire", () => {
  it("non-admin, caché, sans téléchargement ni suppression, mêmes contrôle parental et tags bloqués", async () => {
    const guestId = (await addGuest()).json().userId as string;
    const policy = h.state!.jf.users.get(guestId)!.Policy;
    expect(policy).toMatchObject({
      IsAdministrator: false,
      IsHidden: true,
      EnableContentDownloading: false,
      EnableContentDeletion: false,
      MaxParentalRating: 12, // repris du propriétaire (Damien)
      BlockedTags: ["horreur"], // repris du propriétaire
    });
  });

  it("une session de profil invité n'a ni Watch Together, ni gestion, ni push/téléchargements", async () => {
    const { guest, member } = await withGuestSession();
    for (const door of ["/api/watch-together/group", "/api/tickets/mine", "/api/plugins/seer/requests"]) {
      expect((await get(door, guest)).json().code).toBe("family.guest_account");
      expect((await get(door, member)).statusCode).toBe(200); // un membre garde tout cela
    }
    for (const door of ["/api/push/register", "/api/downloads/capabilities"]) {
      expect((await get(door, guest)).json().code).toBe("family.personal_session_required");
    }
  });
});

describe("SEC-F-29 : le mot de passe de l'invité est fort, jamais stocké ni rendu", () => {
  it("un secret aléatoire, absent de la base Tentacle et de toute réponse", async () => {
    const res = await addGuest();
    const guestId = res.json().userId as string;
    const password = h.state!.jf.users.get(guestId)!.password as string;
    // Fort et aléatoire (jamais un mot de passe deviné).
    expect(password).toMatch(/^[A-Za-z0-9_-]{64}$/);
    // Jamais stocké côté Tentacle, jamais rendu au client.
    expect(JSON.stringify(h.state!.db.data)).not.toContain(password);
    expect(res.body).not.toContain(password);
  });
});
