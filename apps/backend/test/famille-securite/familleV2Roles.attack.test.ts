/**
 * Tests d'attaque T8 — Famille v2 RUNTIME, rôles et droits, contre
 * l'implémentation de T2 par les vraies routes. Seconde barrière, angle
 * attaquant : unicité d'appartenance (SEC-F-36), gestes du propriétaire seuls
 * (SEC-F-37), droit de créer des invités délégué et non auto-octroyable
 * (SEC-F-38/39), capacité (SEC-F-40), aucune élévation de rôle (SEC-F-41).
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
import { IDS, bearer, buildFamilyApp, resetCaches, seedUsers } from "../familyHarness";

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
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const invite = (from: string, userId: string) => send("POST", "/api/family/invitations", from, { userId });
const accept = (token: string, id: string) => send("POST", "/api/family/invitations/accept", token, { id });
const inviteAccept = async (from: string, userId: string, token: string) =>
  accept(token, (await invite(from, userId)).json().id);
const guest = (token: string, name: string) => send("POST", "/api/family/guests", token, { name, color: "teal" });
const setRights = (token: string, userId: string, body: unknown) =>
  send("PUT", `/api/family/members/${userId}/rights`, token, body);
const familyIdOf = () => h.state!.db.data.family[0].id as string;

describe("SEC-F-36 : une seule famille par personne", () => {
  it("accepter une invitation reçue AVANT, une fois devenu membre entre-temps → refusé (une seule famille)", async () => {
    const fromHugo = (await invite(tokens.hugo, IDS.lea)).json().id; // Hugo invite Léa (encore libre)
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea); // puis Léa rejoint Damien
    const res = await accept(tokens.lea, fromHugo); // la vieille invitation de Hugo ne vaut plus
    // Refus (409) : l'adhésion à Damien a clos les autres invitations
    // (`invite_closed`) et une seconde famille serait refusée (`already_in_family`).
    expect(res.statusCode).toBe(409);
    expect(["family.invite_closed", "family.already_in_family"]).toContain(res.json().code);
    // L'invariant qui compte : Léa n'appartient qu'à UNE famille.
    const memberships = (await get("/api/family", tokens.lea)).json().memberships ?? [];
    expect(memberships).toHaveLength(1);
    expect(memberships[0].ownerUserId).toBe(IDS.damien);
  });

  it("inviter un compte déjà dans une autre famille → 409 already_in_family", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    // Hugo fonde sa famille (invite cache), puis tente d'inviter Léa, déjà prise.
    await invite(tokens.hugo, IDS.cache);
    const res = await invite(tokens.hugo, IDS.lea);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("family.already_in_family");
  });

  it("deux acceptations concurrentes → une seule réussit (unicité sous course)", async () => {
    const a = (await invite(tokens.damien, IDS.lea)).json().id;
    const b = (await invite(tokens.hugo, IDS.lea)).json().id;
    const results = await Promise.all([accept(tokens.lea, a), accept(tokens.lea, b)]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    // Léa n'est membre que d'UNE famille.
    const memberships = (await get("/api/family", tokens.lea)).json().memberships ?? [];
    expect(memberships).toHaveLength(1);
  });
});

describe("SEC-F-37 : seuls les gestes du propriétaire, au propriétaire", () => {
  it("un membre n'invite, n'annule, ne retire, ne dissout pas ; le propriétaire ne « quitte » pas", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
    expect((await invite(tokens.lea, IDS.cache)).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/members/${IDS.hugo}`, tokens.lea)).json().code).toBe("family.not_owner");
    expect((await send("DELETE", "/api/family", tokens.lea, { confirm: "dissolve" })).json().code).toBe("family.not_owner");
    // Le propriétaire ne quitte pas sa famille : il la dissout.
    expect((await send("POST", `/api/family/memberships/${familyIdOf()}/leave`, tokens.damien)).json().code)
      .toBe("family.owner_must_dissolve");
  });
});

describe("SEC-F-38 : le droit de créer des invités est délégué, jamais auto-octroyé", () => {
  it("un membre ne règle aucun droit (le sien ni celui d'un autre)", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    await inviteAccept(tokens.damien, IDS.hugo, tokens.hugo);
    expect((await setRights(tokens.lea, IDS.lea, { createGuests: true })).json().code).toBe("family.not_owner");
    expect((await setRights(tokens.lea, IDS.hugo, { createGuests: true })).json().code).toBe("family.not_owner");
  });

  it("sans le droit → guest_right_required ; accordé → crée ; retiré → referme aussitôt", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    expect((await guest(tokens.lea, "Zoé")).json().code).toBe("family.guest_right_required");
    expect((await setRights(tokens.damien, IDS.lea, { createGuests: true })).statusCode).toBe(200);
    expect((await guest(tokens.lea, "Zoé")).statusCode).toBe(200);
    await setRights(tokens.damien, IDS.lea, { createGuests: false });
    expect((await guest(tokens.lea, "Noé")).json().code).toBe("family.guest_right_required");
  });
});

describe("SEC-F-39 : un membre ne gère QUE les invités qu'il a créés", () => {
  it("un membre supprime/épingle ses invités, jamais ceux d'un autre ; le propriétaire, tous", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    await setRights(tokens.damien, IDS.lea, { createGuests: true });
    const mine = (await guest(tokens.lea, "ÀLéa")).json().userId;
    const his = (await guest(tokens.damien, "ÀDamien")).json().userId;
    expect((await send("DELETE", `/api/family/guests/${his}`, tokens.lea)).json().code).toBe("family.not_owner");
    expect((await send("PUT", `/api/family/guests/${his}/pin`, tokens.lea, { pin: "1234" })).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/guests/${mine}`, tokens.lea)).json()).toEqual({ deleted: true });
    expect((await send("DELETE", `/api/family/guests/${his}`, tokens.damien)).json()).toEqual({ deleted: true });
  });
});

describe("SEC-F-40/41 : capacité, et aucune élévation de rôle", () => {
  it("trois invités au plus, même sous créations concurrentes", async () => {
    const names = ["A", "B", "C", "D"];
    const results = await Promise.all(names.map((n) => guest(tokens.damien, n)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(3);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(1);
  });

  it("aucun corps ne fait d'un membre un propriétaire", async () => {
    await inviteAccept(tokens.damien, IDS.lea, tokens.lea);
    // Glisser des champs de propriétaire dans le réglage des droits : ignorés.
    await setRights(tokens.damien, IDS.lea, { createGuests: true, manageMembers: true, role: "owner", manageGuests: "all" });
    const me = (await get("/api/family", tokens.lea)).json();
    expect(me.memberships[0]).toMatchObject({ ownerUserId: IDS.damien });
    // Léa reste membre : elle ne gère pas les membres.
    expect((await send("DELETE", `/api/family/members/${IDS.damien}`, tokens.lea)).json().code).toBe("family.not_owner");
    expect((await invite(tokens.lea, IDS.hugo)).json().code).toBe("family.not_owner");
  });
});
