/**
 * Tests d'attaque T8 — Famille v2, la DÉLÉGATION « agit pour » (droit d'invité
 * « peut demander », `requestTitles`). Un invité autorisé se présente aux
 * routes d'EXTENSION sous l'identité du propriétaire, et à elles seules.
 *
 * Le point dur (consigne T2) : un invité délégué ne doit JAMAIS atteindre une
 * route hors /api/plugins avec l'identité du propriétaire, ni une route d'admin
 * d'extension. Le droit se relit à chaque requête : le retirer coupe aussitôt.
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

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  // Une route d'ADMIN d'extension, comme en porterait une extension réelle.
  app = await buildFamilyApp(async (fastify) => {
    fastify.get("/api/plugins/seer/admin/settings", { preHandler: [requireAdmin] }, async (req) => ({ user: (req as unknown as { user: unknown }).user }));
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

const send = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const rights = (userId: string, body: unknown) => send("PUT", `/api/family/guests/${userId}/rights`, tokens.damien, body);
const EXTENSION = "/api/plugins/seer/requests"; // porte témoin montée par le harnais (requireAuth)

/** Un invité de Damien, et une session de profil invité ouverte sur sa TV. */
async function guestSession(): Promise<{ zoe: string; session: string }> {
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
  const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const session = (await openProfile(app, pairing, { profileId: zoe })).json().token as string;
  return { zoe, session };
}

describe("délégation : un invité autorisé agit pour le propriétaire — sur les extensions SEULEMENT", () => {
  it("sur /api/plugins : identité du propriétaire, jamais admin, delegatedBy = l'invité", async () => {
    const { zoe, session } = await guestSession();
    expect((await rights(zoe, { requestTitles: true })).json()).toEqual({ requestTitles: true });
    const seen = (await send("GET", EXTENSION, session)).json().user;
    expect(seen.userId).toBe(IDS.damien); // agit POUR le propriétaire
    expect(seen.isAdmin).toBe(false); // jamais administrateur
    expect(seen.session).toBe("tvProfile");
    expect(seen.delegatedBy).toEqual({ userId: zoe, username: "Zoé" });
  });

  it("POINT DUR : hors /api/plugins, l'invité reste LUI-MÊME (jamais l'identité du propriétaire)", async () => {
    const { zoe, session } = await guestSession();
    await rights(zoe, { requestTitles: true });
    // Une route quelconque sous session : c'est l'invité, pas le propriétaire.
    const me = (await send("GET", "/api/protected", session)).json().user;
    expect(me.userId).toBe(zoe);
    expect(me.userId).not.toBe(IDS.damien);
    expect(me.delegatedBy).toBeUndefined();
    // L'overview de la Famille reste lu au nom de l'invité.
    const ov = await send("GET", "/api/family", session);
    expect(JSON.stringify(ov.json())).not.toContain('"delegatedBy"');
  });

  it("POINT DUR : une route d'ADMIN d'extension refuse l'invité délégué (403, car jamais admin)", async () => {
    const { zoe, session } = await guestSession();
    await rights(zoe, { requestTitles: true });
    expect((await send("GET", "/api/plugins/seer/admin/settings", session)).statusCode).toBe(403);
  });
});

describe("délégation : cantonnée, révocable, réservée au propriétaire", () => {
  it("un invité autorisé n'a toujours ni Watch Together, ni tickets, ni push (il n'est dans aucune liste)", async () => {
    const { zoe, session } = await guestSession();
    await rights(zoe, { requestTitles: true });
    expect((await send("GET", "/api/watch-together/group", session)).json().code).toBe("family.guest_account");
    expect((await send("GET", "/api/tickets/mine", session)).json().code).toBe("family.guest_account");
    expect((await send("GET", "/api/push/register", session)).json().code).toBe("family.personal_session_required");
  });

  it("un invité SANS le droit ne voit rien des extensions (403 guest_account)", async () => {
    const { session } = await guestSession();
    expect((await send("GET", EXTENSION, session)).json().code).toBe("family.guest_account");
  });

  it("retirer le droit coupe à l'appel SUIVANT, et pousse family:update à l'invité", async () => {
    const { zoe, session } = await guestSession();
    await rights(zoe, { requestTitles: true });
    expect((await send("GET", EXTENSION, session)).json().user.userId).toBe(IDS.damien);
    expect((await rights(zoe, { requestTitles: false })).json()).toEqual({ requestTitles: false });
    expect((await send("GET", EXTENSION, session)).json().code).toBe("family.guest_account");
    expect(h.state!.socket.some((s) => s.userId === zoe && s.msg.type === "family:update")).toBe(true);
  });

  it("seul le propriétaire règle le droit ; un membre garde SON identité sur les extensions", async () => {
    const { zoe } = await guestSession();
    // Léa, membre : elle ne règle aucun droit d'invité, et reste elle-même sur /api/plugins.
    const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
    await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
    expect((await send("PUT", `/api/family/guests/${zoe}/rights`, tokens.lea, { requestTitles: true })).json().code).toBe("family.not_owner");
    const leaTv = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa"));
    const leaProfile = (await openProfile(app, leaTv, { profileId: IDS.lea })).json().token as string;
    const asMember = (await send("GET", EXTENSION, leaProfile)).json().user;
    expect(asMember.userId).toBe(IDS.lea); // un membre agit sous SON identité
    expect(asMember.delegatedBy).toBeUndefined();
  });
});
