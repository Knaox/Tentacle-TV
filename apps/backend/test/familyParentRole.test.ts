/**
 * Le rôle de PARENT (1.30.0), par les vraies routes : le propriétaire seul le donne
 * et le retire ; un parent gère les enfants — tous les invités (droits, photo, PIN,
 * contrôle parental) —, jamais les membres, les rôles ni la dissolution.
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
vi.mock("../src/services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { allowGuestRequests, IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "./familyHarness";
import { GUEST_PARENTAL_NONE } from "../src/family/familyParental";
import { clearUserRightsOptions } from "../src/services/userRights/userRightsOptions";
import { withParentalOptions } from "./fakeJellyfinParental";

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
  h.fetch = withParentalOptions(fakeJellyfinUsersFetch(h.state.jf));
  resetCaches();
  // 1.30.0 : l'administration laisse les invités demander (le sens de ce banc, d'avant ce réglage).
  allowGuestRequests(h.state!, { everyone: true });
  clearUserRightsOptions();
  tokens = seedUsers(h.state);
});

const send = (method: "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const accept = async (from: string, userId: string, token: string) => {
  const id = (await send("POST", "/api/family/invitations", from, { userId })).json().id;
  return send("POST", "/api/family/invitations/accept", token, { id });
};
const role = (token: string, userId: string, parent: boolean) => send("PUT", `/api/family/members/${userId}/role`, token, { parent });
const refusal = (res: { statusCode: number; json: () => { code?: string } }) => [res.statusCode, res.json().code];

/** Damien propriétaire, Léa et Hugo membres ; Hugo a un invité à lui. */
async function family(): Promise<{ lili: string; tom: string }> {
  await accept(tokens.damien, IDS.lea, tokens.lea);
  await accept(tokens.damien, IDS.hugo, tokens.hugo);
  await send("PUT", `/api/family/members/${IDS.hugo}/rights`, tokens.damien, { createGuests: true });
  const lili = (await send("POST", "/api/family/guests", tokens.damien, { name: "Lili", color: "teal" })).json().userId as string;
  const tom = (await send("POST", "/api/family/guests", tokens.hugo, { name: "Tom", color: "blue" })).json().userId as string;
  return { lili, tom };
}

describe("nommer un parent", () => {
  it("le propriétaire nomme Léa parent : tous le lisent, elle gère les enfants", async () => {
    await family();
    expect((await role(tokens.damien, IDS.lea, true)).json()).toEqual({ parent: true });
    const lea = (await get("/api/family", tokens.lea)).json().family;
    expect(lea.parent).toBe(true);
    expect(lea.rights).toEqual({ manageMembers: false, createGuests: true, manageGuests: "all", manageRoles: false, manageMinors: true });
    const seen = (await get("/api/family", tokens.hugo)).json().family.profiles.find((p: { userId: string }) => p.userId === IDS.lea);
    expect(seen.parent).toBe(true);
    expect((await role(tokens.damien, IDS.lea, false)).json()).toEqual({ parent: false });
    expect((await get("/api/family", tokens.lea)).json().family.rights.manageGuests).toBe("own");
  });

  it("personne d'autre ne nomme : ni un membre, ni un parent, ni un compte hors de la famille", async () => {
    await family();
    await role(tokens.damien, IDS.lea, true);
    expect(refusal(await role(tokens.hugo, IDS.lea, false))).toEqual([403, "family.not_owner"]);
    expect(refusal(await role(tokens.lea, IDS.hugo, true))).toEqual([403, "family.not_owner"]);
    expect(refusal(await role(tokens.cache, IDS.hugo, true))).toEqual([404, "family.not_found"]);
  });

  it("jamais sur un invité ni sur le propriétaire (comme les droits d'un membre : introuvable)", async () => {
    const { lili } = await family();
    expect(refusal(await role(tokens.damien, lili, true))).toEqual([404, "family.not_found"]);
    expect(refusal(await role(tokens.damien, IDS.damien, true))).toEqual([404, "family.not_found"]);
    expect((await send("PUT", `/api/family/members/${IDS.lea}/role`, tokens.damien, { parent: "oui" })).statusCode).toBe(400);
  });
});

describe("ce que fait un parent", () => {
  it("règle les invités des autres comme le propriétaire : PIN, droits, contrôle parental, photo", async () => {
    const { lili, tom } = await family();
    await role(tokens.damien, IDS.lea, true);
    expect((await send("PUT", `/api/family/guests/${tom}/pin`, tokens.lea, { pin: "2468" })).statusCode).toBe(200);
    expect((await send("PUT", `/api/family/guests/${lili}/rights`, tokens.lea, { requestTitles: true })).json()).toEqual({ requestTitles: true });
    const res = await send("PUT", `/api/family/guests/${lili}/parental`, tokens.lea, { ...GUEST_PARENTAL_NONE, maxParentalRating: 6 });
    expect(res.statusCode).toBe(200);
    expect(h.state!.jf.users.get(lili)!.Policy.MaxParentalRating).toBe(6);
    expect((await get("/api/family/parental/options", tokens.lea)).statusCode).toBe(200);
    const view = (await get("/api/family", tokens.lea)).json().family.profiles.find((p: { userId: string }) => p.userId === tom);
    expect(view.parentalCeiling).toBeDefined();
  });

  it("crée des invités sans la permission du propriétaire ; jamais au-delà du droit de compte", async () => {
    await family();
    await role(tokens.damien, IDS.lea, true);
    expect((await send("POST", "/api/family/guests", tokens.lea, { name: "Zoé", color: "pink" })).statusCode).toBe(200);
    await send("PUT", `/api/admin/family/accounts/${IDS.lea}`, tokens.damien, { createGuests: "deny" });
    expect(refusal(await send("POST", "/api/family/guests", tokens.lea, { name: "Max", color: "pink" }))).toEqual([403, "family.create_guests_denied"]);
  });

  it("n'invite pas, ne retire pas, ne dissout pas, ne règle pas les droits d'un membre", async () => {
    await family();
    await role(tokens.damien, IDS.lea, true);
    expect(refusal(await send("POST", "/api/family/invitations", tokens.lea, { userId: IDS.cache }))).toEqual([403, "family.not_owner"]);
    expect(refusal(await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.lea))).toEqual([403, "family.not_owner"]);
    expect(refusal(await send("PUT", `/api/family/members/${IDS.hugo}/rights`, tokens.lea, { createGuests: false }))).toEqual([403, "family.not_owner"]);
    expect(refusal(await send("DELETE", "/api/family", tokens.lea, { confirm: "dissolve" }))).toEqual([403, "family.not_owner"]);
  });

  it("un simple membre ne règle toujours que SES invités", async () => {
    const { lili, tom } = await family();
    expect(refusal(await send("PUT", `/api/family/guests/${lili}/pin`, tokens.hugo, { pin: "1357" }))).toEqual([403, "family.not_owner"]);
    expect(refusal(await send("PUT", `/api/family/guests/${tom}/rights`, tokens.hugo, { requestTitles: true }))).toEqual([403, "family.not_owner"]);
  });
});
