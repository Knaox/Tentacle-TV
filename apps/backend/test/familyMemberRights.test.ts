/**
 * Contrat v2, par les vraies routes : la famille vue par le propriétaire ET
 * par le membre (`family`, rôle et droits), le créateur d'un invité, et les
 * droits d'un membre — que seul le propriétaire règle.
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
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";

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
const overview = async (token: string) => (await app.inject({ method: "GET", url: "/api/family", headers: bearer(token) })).json();
const setRights = (token: string, userId: string, payload: unknown) =>
  app.inject({ method: "PUT", url: `/api/family/members/${userId}/rights`, headers: bearer(token), payload: payload as object });

async function leaMember(): Promise<void> {
  const id = (await post("/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  expect((await post("/api/family/invitations/accept", tokens.lea, { id })).statusCode).toBe(200);
}

describe("la famille v2, vue par chacun", () => {
  it("le propriétaire et le membre lisent la MÊME famille, chacun avec son rôle et ses droits", async () => {
    await leaMember();
    const guest = (await post("/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json();
    expect(guest).toMatchObject({ kind: "guest", createdBy: IDS.damien, createdByName: "Damien", rights: null });

    const owner = (await overview(tokens.damien)).family;
    const member = (await overview(tokens.lea)).family;
    expect(owner).toMatchObject({ role: "owner", since: null, rights: { manageMembers: true, createGuests: true, manageGuests: "all" } });
    expect(member).toMatchObject({ role: "member", rights: { manageMembers: false, createGuests: false, manageGuests: "own" } });
    expect(member.since).toBeTruthy();
    expect(member.profiles).toEqual(owner.profiles);
    expect(member.owner).toEqual({ userId: IDS.damien, name: "Damien" });
    expect(owner.profiles.map((p: { kind: string }) => p.kind)).toEqual(["owner", "member", "guest"]);
    expect(owner.profiles[1].rights).toEqual({ createGuests: false });
  });

  it("le membre ne voit pas les invitations en attente du propriétaire", async () => {
    await leaMember();
    await post("/api/family/invitations", tokens.damien, { userId: IDS.hugo });
    expect((await overview(tokens.damien)).family.pendingInvitations).toHaveLength(1);
    expect((await overview(tokens.lea)).family.pendingInvitations).toEqual([]);
  });
});

describe("les droits d'un membre", () => {
  it("le propriétaire les pose et les retire ; le membre le lit aussitôt", async () => {
    await leaMember();
    const on = await setRights(tokens.damien, IDS.lea, { createGuests: true });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toEqual({ createGuests: true });
    expect((await overview(tokens.lea)).family.rights.createGuests).toBe(true);
    expect(h.state!.socket.filter((s) => s.msg.type === "family:update").map((s) => s.userId)).toContain(IDS.lea);

    expect((await setRights(tokens.damien, IDS.lea, {})).json()).toEqual({ createGuests: true });
    expect((await setRights(tokens.damien, IDS.lea, { createGuests: false })).json()).toEqual({ createGuests: false });
    expect((await overview(tokens.damien)).family.profiles[1].rights).toEqual({ createGuests: false });
  });

  it("ni le membre, ni un compte sans lien, ni sur un invité : rien ne bouge", async () => {
    await leaMember();
    const guestId = (await post("/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId;
    const self = await setRights(tokens.lea, IDS.lea, { createGuests: true });
    expect(self.statusCode).toBe(403);
    expect(self.json().code).toBe("family.not_owner");
    expect((await setRights(tokens.hugo, IDS.lea, { createGuests: true })).statusCode).toBe(404);
    expect((await setRights(tokens.damien, guestId, { createGuests: true })).statusCode).toBe(404);
    expect((await setRights(tokens.damien, IDS.lea, { createGuests: "oui" })).json().code).toBe("family.invalid_input");
    expect(h.state!.db.data.familyMember.find((m) => m.userId === IDS.lea)?.canCreateGuests ?? false).toBe(false);
  });
});
