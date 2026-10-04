/**
 * Les invitations de la Famille par les vraies routes : l'inviteur et le
 * destinataire sont les porteurs des jetons (SEC-F-01/02), une invitation
 * d'autrui n'existe pas (404, SEC-F-03), une invitation échue ne s'accepte
 * plus (410, SEC-F-05), un refus fait attendre (SEC-F-23), les candidats ne
 * trahissent aucun compte caché (SEC-F-22), le compte de démonstration ne
 * crée rien (SEC-F-28). Cloche, push et socket : aux seuls concernés.
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

const post = (url: string, token: string, payload?: unknown) => app.inject({ method: "POST", url, headers: bearer(token), payload: payload as object });
const invite = (from: string, userId: string, extra: Record<string, unknown> = {}) => post("/api/family/invitations", from, { userId, ...extra });
const overview = async (token: string) => (await app.inject({ method: "GET", url: "/api/family", headers: bearer(token) })).json();

describe("inviter et répondre", () => {
  it("l'invitation part au nom du porteur, et ne prévient que le destinataire", async () => {
    const res = await invite(tokens.damien, IDS.lea, { ownerUserId: IDS.hugo, fromUserId: IDS.hugo });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(id.length).toBeGreaterThanOrEqual(22);
    expect(h.state!.db.data.familyInvitation[0]).toMatchObject({ ownerUserId: IDS.damien, inviteeUserId: IDS.lea });
    expect(h.state!.pushes).toEqual([expect.objectContaining({ userId: IDS.lea, data: { type: "family_invite", refId: id } })]);
    expect(JSON.stringify(h.state!.pushes)).not.toMatch(/jf-|Token|pin/i);
    expect(h.state!.socket.filter((s) => s.msg.type === "family:update").map((s) => s.userId).sort()).toEqual([IDS.damien, IDS.lea].sort());
    expect((await overview(tokens.lea)).incoming).toEqual([expect.objectContaining({ id, ownerName: "Damien", snoozedUntil: null })]);
    expect((await overview(tokens.hugo)).incoming).toEqual([]);
  });

  it("seul le destinataire accepte, en session personnelle — jamais depuis une TV", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    expect((await post("/api/family/invitations/accept", tokens.hugo, { id })).statusCode).toBe(404);
    expect((await post("/api/family/invitations/accept", tokens.damien, { id })).statusCode).toBe(404);
    const leaTv = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa"));
    const leaSession = (await openProfile(app, leaTv, { profileId: IDS.lea })).json().token;
    const fromTv = await post("/api/family/invitations/accept", leaSession, { id });
    expect(fromTv.statusCode).toBe(403);
    expect(fromTv.json().code).toBe("family.personal_session_required");
    expect((await post("/api/family/invitations/accept", leaTv, { id })).statusCode).toBe(401);

    const accepted = await post("/api/family/invitations/accept", tokens.lea, { id });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ ownerUserId: IDS.damien, ownerName: "Damien" });
    const bell = h.state!.db.data.notification.map((n) => [n.jellyfinUserId, n.type]);
    expect(bell).toEqual([[IDS.damien, "family_invite_accepted"]]);
    expect((await overview(tokens.damien)).owned.profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.damien, IDS.lea]);
  });

  it("une invitation d'autrui n'existe pas : même réponse qu'un identifiant inventé", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    const foreign = await post("/api/family/invitations/decline", tokens.hugo, { id });
    const invented = await post("/api/family/invitations/decline", tokens.hugo, { id: "A".repeat(22) });
    expect([foreign.statusCode, invented.statusCode]).toEqual([404, 404]);
    expect(foreign.json()).toEqual(invented.json());
    expect((await post("/api/family/invitations/cancel", tokens.lea, { id })).json().code).toBe("family.not_owner");
  });

  it("une invitation échue ne s'accepte plus (410) et quitte la cloche", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    h.state!.db.data.familyInvitation[0].expiresAt = new Date(Date.now() - 1000);
    const res = await post("/api/family/invitations/accept", tokens.lea, { id });
    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe("family.invite_expired");
    expect(h.state!.db.data.familyMember.filter((m) => m.kind !== "owner")).toHaveLength(0);
    expect(h.state!.db.data.notification.filter((n) => n.jellyfinUserId === IDS.lea)).toHaveLength(0);
  });

  it("après un refus, le même propriétaire attend avant de réinviter", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    expect((await post("/api/family/invitations/decline", tokens.lea, { id })).json()).toEqual({ declined: true });
    const again = await invite(tokens.damien, IDS.lea);
    expect(again.statusCode).toBe(429);
    expect(again.json()).toMatchObject({ code: "family.invite_cooldown", retryAt: expect.any(String) });
  });

  it("« Plus tard » tait l'affiche un jour ; annuler retire l'invitation et la cloche", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    expect((await post("/api/family/invitations/snooze", tokens.lea, { id })).json().snoozedUntil).toBeTruthy();
    expect((await post("/api/family/invitations/cancel", tokens.damien, { id })).json()).toEqual({ cancelled: true });
    expect((await overview(tokens.lea)).incoming).toEqual([]);
    expect((await post("/api/family/invitations/accept", tokens.lea, { id })).json()).toMatchObject({ code: "family.invite_closed", status: "cancelled" });
  });
});

describe("les candidats (v2)", () => {
  const candidates = async (token: string, q = "") =>
    app.inject({ method: "GET", url: `/api/family/candidates${q ? `?q=${encodeURIComponent(q)}` : ""}`, headers: bearer(token) });
  const list = async (q = "") => (await candidates(tokens.damien, q)).json().map((c: { name: string; status: string }) => [c.name, c.status]);

  it("tous les comptes, cachés compris ; jamais un désactivé, soi-même, un invité ni le compte de démonstration", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { code: "X".repeat(12), jellyfinUserId: IDS.demo, username: "Demo" } });
    await post("/api/family/guests", tokens.damien, { name: "Zoé", color: "pink" });
    expect(await list()).toEqual([["Caché", "available"], ["Hugo", "available"], ["Léa", "available"]]);
    expect(await list("cach")).toEqual([["Caché", "available"]]);
    expect((await invite(tokens.damien, IDS.coupe)).json().code).toBe("family.candidate_invalid");
    expect((await invite(tokens.damien, IDS.damien)).json().code).toBe("family.candidate_invalid");
  });

  it("marque l'invité en attente et le compte déjà dans une famille — sans dire laquelle — et les met après", async () => {
    await invite(tokens.damien, IDS.lea);
    // Hugo fonde sa famille en invitant Caché : Hugo est pris, Caché pas encore.
    await invite(tokens.hugo, IDS.cache);
    expect(await list()).toEqual([
      ["Caché", "available"],
      ["Demo", "available"],
      ["Hugo", "in_family"],
      ["Léa", "invited"],
    ]);
    const hugoSees = (await candidates(tokens.hugo)).json();
    expect(hugoSees.find((c: { userId: string }) => c.userId === IDS.damien)).toMatchObject({ status: "in_family" });
    expect(Object.keys(hugoSees[0]).sort()).toEqual(["imageTag", "name", "status", "userId"]);
  });

  it("un membre n'en voit aucun : il n'invite personne", async () => {
    const id = (await invite(tokens.damien, IDS.lea)).json().id;
    await post("/api/family/invitations/accept", tokens.lea, { id });
    const res = await candidates(tokens.lea);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.not_owner");
  });
});

describe("le compte de démonstration", () => {
  it("ne crée ni famille, ni invité, ni invitation, et n'est jamais candidat", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { code: "X".repeat(12), jellyfinUserId: IDS.demo, username: "Demo" } });
    expect((await invite(tokens.demo, IDS.lea)).json().code).toBe("family.review_account");
    expect((await post("/api/family/guests", tokens.demo, { name: "Zoé", color: "pink" })).json().code).toBe("family.review_account");
    const dissolve = await app.inject({ method: "DELETE", url: "/api/family", headers: bearer(tokens.demo), payload: { confirm: "dissolve" } });
    expect(dissolve.json().code).toBe("family.review_account");
    const remove = await app.inject({ method: "DELETE", url: `/api/family/members/${IDS.lea}`, headers: bearer(tokens.demo) });
    expect(remove.json().code).toBe("family.review_account");
    expect(h.state!.db.data.family).toHaveLength(0);
    expect((await invite(tokens.damien, IDS.demo)).json().code).toBe("family.candidate_invalid");
    expect((await overview(tokens.demo)).account).toMatchObject({ reviewAccount: true, canOwn: false, canJoin: false });
    const tv = await enroll(app, await pairTv(h.state!, IDS.demo, "Demo"));
    const listing = await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(tv) });
    expect(listing.json().canManage).toBe(false);
  });
});
