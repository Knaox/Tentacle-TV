/**
 * Le droit d'invité « peut demander » (Famille v2), par les vraies routes : le
 * propriétaire SEUL le règle ; un invité qui l'a se présente aux routes
 * d'EXTENSION — et à elles seules — sous l'identité du propriétaire, jamais
 * administrateur (délégation « agit pour ») ; sans le droit, aucune extension ;
 * le retirer coupe à l'appel suivant.
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
import { requireAdmin, requireAuth } from "../src/middleware/auth";
import { familyCapability } from "../src/services/family/familyConfig";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

const echo = async (request: unknown) => ({ user: (request as { user: unknown }).user });

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildFamilyApp(async (scope) => {
    scope.get("/api/share/links", { preHandler: [requireAuth] }, echo);
    scope.get("/api/plugins/seer/admin/settings", { preHandler: [requireAdmin] }, echo);
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

const send = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const rights = (token: string, userId: string, payload: unknown) => send("PUT", `/api/family/guests/${userId}/rights`, token, payload);
const EXTENSION = "/api/plugins/seer/requests";

/** Zoé, invitée de Damien (administrateur), et sa session ouverte sur la TV de Damien. */
async function zoeOnTv(): Promise<{ zoe: string; session: string; pairing: string }> {
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
  const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
  const session = (await openProfile(app, pairing, { profileId: zoe })).json().token as string;
  return { zoe, session, pairing };
}

describe("le droit d'invité « peut demander »", () => {
  it("sans le droit : aucune extension, comme si le serveur n'en avait pas", async () => {
    const { session } = await zoeOnTv();
    const res = await send("GET", EXTENSION, session);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.guest_account");
  });

  it("avec le droit : les extensions voient le PROPRIÉTAIRE, jamais administrateur, et l'invité qui agit", async () => {
    const { zoe, session } = await zoeOnTv();
    expect((await rights(tokens.damien, zoe, { requestTitles: true })).json()).toEqual({ requestTitles: true });
    const seen = (await send("GET", EXTENSION, session)).json().user;
    expect(seen).toMatchObject({ userId: IDS.damien, username: "Damien", isAdmin: false, session: "tvProfile" });
    expect(seen.delegatedBy).toEqual({ userId: zoe, username: "Zoé" });
    // Damien est administrateur : son invité n'en hérite jamais, même sur une route d'extension.
    expect((await send("GET", "/api/plugins/seer/admin/settings", session)).statusCode).toBe(403);
  });

  it("nulle part ailleurs : ni Watch Together, ni tickets, ni partage — et partout, l'invité reste lui-même", async () => {
    const { zoe, session } = await zoeOnTv();
    await rights(tokens.damien, zoe, { requestTitles: true });
    for (const path of ["/api/watch-together/group", "/api/tickets/mine", "/api/share/links"]) {
      expect((await send("GET", path, session)).json().code, path).toBe("family.guest_account");
    }
    expect((await send("GET", "/api/push/register", session)).json().code).toBe("family.personal_session_required");
    expect((await send("GET", "/api/protected", session)).json().user).toMatchObject({ userId: zoe, isAdmin: false });
  });

  it("le retirer coupe à l'appel suivant, et la session de l'invité l'apprend", async () => {
    const { zoe, session } = await zoeOnTv();
    await rights(tokens.damien, zoe, { requestTitles: true });
    expect((await send("GET", EXTENSION, session)).statusCode).toBe(200);
    h.state!.socket.length = 0;
    expect((await rights(tokens.damien, zoe, { requestTitles: false })).json()).toEqual({ requestTitles: false });
    expect((await send("GET", EXTENSION, session)).json().code).toBe("family.guest_account");
    expect(h.state!.socket.some((s) => s.userId === zoe && s.msg.type === "family:update")).toBe(true);
  });

  it("le propriétaire SEUL le règle ; un membre garde SON identité sur les extensions", async () => {
    const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
    await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
    const { zoe, pairing } = await zoeOnTv();
    expect((await rights(tokens.lea, zoe, { requestTitles: true })).json().code).toBe("family.not_owner");
    expect((await rights(tokens.hugo, zoe, { requestTitles: true })).statusCode).toBe(404);
    expect((await rights(tokens.damien, IDS.lea, { requestTitles: true })).statusCode).toBe(404);
    expect((await rights(tokens.damien, zoe, { requestTitles: "oui" })).json().code).toBe("family.invalid_input");
    const guestSession = (await openProfile(app, pairing, { profileId: zoe })).json().token as string;
    expect((await rights(guestSession, zoe, { requestTitles: true })).statusCode).toBe(403);
    const leaSession = (await openProfile(app, pairing, { profileId: IDS.lea })).json().token as string;
    expect((await send("GET", EXTENSION, leaSession)).json().user).toMatchObject({ userId: IDS.lea });
    expect((await send("GET", EXTENSION, leaSession)).json().user.delegatedBy).toBeUndefined();
  });

  it("se lit partout où l'invité paraît, et la capacité l'annonce", async () => {
    const { zoe, pairing } = await zoeOnTv();
    await rights(tokens.damien, zoe, { requestTitles: true });
    const profile = (await send("GET", "/api/family", tokens.damien)).json().family.profiles.find((p: { userId: string }) => p.userId === zoe);
    expect(profile.guestRights).toEqual({ requestTitles: true });
    const tv = (await send("GET", "/api/family/tv/profiles", pairing)).json().profiles.find((p: { userId: string }) => p.userId === zoe);
    expect(tv.guestRights).toEqual({ requestTitles: true });
    expect(familyCapability()).toMatchObject({ v: 2, guestRequests: true });
  });
});
