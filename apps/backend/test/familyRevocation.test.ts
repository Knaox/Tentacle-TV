/**
 * Ce qui coupe une session de profil, et AVANT la réponse (SEC-F-10..15) :
 * jeton refusé, socket prévenue, appareil Jellyfin supprimé (`DELETE
 * /Devices`). Retirer un membre ne touche jamais son compte ; supprimer un
 * invité supprime le sien ; les interrupteurs coupent ce qu'ils couvrent, et
 * les rallumer ne ressuscite rien. Le compte invité naît caché, sans droit,
 * avec un mot de passe que personne ne connaît (SEC-F-29/31).
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
import { resolvePairedDeviceToken } from "../src/services/deviceTokenHealth";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildFamilyApp();
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

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const status = async (token: string) => (await app.inject({ method: "GET", url: "/api/protected", headers: bearer(token) })).json();

/** Léa membre de la famille de Damien, sa session ouverte sur la TV de Damien,
 *  son jeton Jellyfin propre frappé (Quick Connect). */
async function leaOnDamiensTv(): Promise<{ pairing: string; session: string; jellyfinToken: string }> {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
  const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const session = (await openProfile(app, pairing, { profileId: IDS.lea })).json().token as string;
  const jellyfinToken = (await resolvePairedDeviceToken(session, IDS.lea)) as string;
  return { pairing, session, jellyfinToken };
}

const deviceOf = (token: string) => [...h.state!.jf.devices.values()].find((d) => d.token === token);

describe("un membre retiré, un membre qui part", () => {
  it("le retrait coupe sa session partout, Jellyfin compris, avant la réponse — son compte reste", async () => {
    const lea = await leaOnDamiensTv();
    expect(deviceOf(lea.jellyfinToken)?.userId).toBe(IDS.lea);
    const res = await send("DELETE", `/api/family/members/${IDS.lea}`, tokens.damien);
    expect(res.json()).toEqual({ removed: true });
    expect(deviceOf(lea.jellyfinToken)).toBeUndefined();
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(h.state!.ended).toContainEqual([expect.any(String), "removed"]);
    expect(h.state!.jf.users.has(IDS.lea)).toBe(true);
    expect(h.state!.db.data.notification.map((n) => [n.jellyfinUserId, n.type])).toContainEqual([IDS.lea, "family_member_removed"]);
  });

  it("partir de soi-même fait de même ; un membre ne retire personne (403), un autre compte rien (404)", async () => {
    const lea = await leaOnDamiensTv();
    const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.hugo })).json().id;
    await send("POST", "/api/family/invitations/accept", tokens.hugo, { id });
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.lea)).statusCode).toBe(403);
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.cache)).statusCode).toBe(404);

    const familyId = h.state!.db.data.family[0].id as string;
    expect((await send("POST", `/api/family/memberships/${familyId}/leave`, tokens.lea)).json()).toEqual({ left: true });
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(deviceOf(lea.jellyfinToken)).toBeUndefined();
  });
});

describe("les invités", () => {
  it("naissent cachés, sans droit, avec les bibliothèques et restrictions du propriétaire et un mot de passe inconnu", async () => {
    const res = await send("POST", "/api/family/guests", tokens.damien, { name: "  Zoé <b>\n", color: "pink" });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Zoé <b>");
    const guest = h.state!.jf.users.get(res.json().userId)!;
    expect(guest.Name).toBe("Zoe b - invite de Damien");
    expect(guest.Policy).toMatchObject({
      IsAdministrator: false, IsHidden: true, EnableContentDownloading: false, EnableContentDeletion: false,
      MaxParentalRating: 12, BlockedTags: ["horreur"],
    });
    expect(guest.password).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(JSON.stringify(h.state!.db.data)).not.toContain(guest.password);
    expect(res.body).not.toContain(guest.password);
  });

  it("la suppression coupe ses sessions puis supprime son compte Jellyfin", async () => {
    const guestId = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" })).json().userId;
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const session = (await openProfile(app, pairing, { profileId: guestId })).json().token;
    await resolvePairedDeviceToken(session, guestId);
    expect((await send("DELETE", `/api/family/guests/${guestId}`, tokens.damien)).json()).toEqual({ deleted: true });
    expect(h.state!.jf.users.has(guestId)).toBe(false);
    expect((await status(session)).profileEnded).toBe(true);
    expect([...h.state!.jf.devices.values()].some((d) => d.userId === guestId)).toBe(false);
  });

  it("trois au plus, six profils au plus, même lancés ensemble", async () => {
    const names = ["Zoé", "Noé", "Léo", "Max"];
    const results = await Promise.all(names.map((name) => send("POST", "/api/family/guests", tokens.damien, { name, color: "blue" })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 200, 200, 409]);
    expect(h.state!.db.data.familyMember).toHaveLength(3);
    expect(h.state!.db.data.family).toHaveLength(1);
  });
});

describe("les interrupteurs de l'administration", () => {
  it("couper la Famille coupe les sessions des membres et refuse les gestes ; la rallumer ne ressuscite rien", async () => {
    const lea = await leaOnDamiensTv();
    const off = await send("PUT", "/api/admin/family", tokens.damien, { families: false });
    expect(off.json()).toEqual({ families: false, guests: true });
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(h.state!.ended).toContainEqual([expect.any(String), "families_disabled"]);
    expect((await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.hugo })).json().code).toBe("family.disabled");
    expect((await openProfile(app, lea.pairing, { profileId: IDS.lea })).json().code).toBe("family.disabled");
    await send("PUT", "/api/admin/family", tokens.damien, { families: true });
    expect((await status(lea.session)).profileEnded).toBe(true);
  });

  it("sont réservés à un administrateur en session personnelle", async () => {
    expect((await send("PUT", "/api/admin/family", tokens.lea, { families: false })).statusCode).toBe(403);
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const session = (await openProfile(app, pairing, { profileId: IDS.damien })).json().token;
    expect((await send("PUT", "/api/admin/family", session, { families: false })).statusCode).toBe(403);
  });
});

describe("dissoudre", () => {
  it("sort les membres, supprime les invités de Jellyfin, ferme les invitations", async () => {
    const lea = await leaOnDamiensTv();
    const guestId = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" })).json().userId;
    await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.hugo });
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "oui" })).statusCode).toBe(400);
    expect((await send("DELETE", "/api/family", tokens.damien, { confirm: "dissolve" })).json()).toEqual({ dissolved: true });
    expect(h.state!.db.data.family).toHaveLength(0);
    expect(h.state!.db.data.familyMember).toHaveLength(0);
    expect(h.state!.jf.users.has(guestId)).toBe(false);
    expect(h.state!.jf.users.has(IDS.lea)).toBe(true);
    expect((await status(lea.session)).profileEnded).toBe(true);
    expect(h.state!.db.data.familyInvitation.map((i) => i.status)).toEqual(["accepted", "cancelled"]);
  });
});
