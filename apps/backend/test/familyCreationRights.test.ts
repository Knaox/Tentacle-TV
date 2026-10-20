/**
 * Les droits de créer une famille et des invités (1.30.0), par les vraies routes :
 * NON par défaut, `inherit` suit le défaut de l'administration, les interrupteurs
 * restent maîtres, un administrateur Jellyfin peut toujours, ce qui existe ne
 * tombe pas, et les refus se disent par un code du contrat.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ state: null as null | import("./familyMocks").HarnessState }));
vi.mock("../src/services/configStore", async () => (await import("./familyMocks")).configStoreMock(() => h.state!));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());
vi.mock("../src/services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, buildFamilyApp, enroll, pairTv, resetCaches, seedUsers } from "./familyHarness";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => fakeJellyfinUsersFetch(h.state!.jf)(input, init));
  app = await buildFamilyApp();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  h.state = freshState();
  // Un vrai serveur : aucun défaut posé — NON pour les deux.
  h.state.config.delete("family_default_create_family");
  h.state.config.delete("family_default_create_guests");
  resetCaches();
  tokens = seedUsers(h.state);
});

const send = (method: "POST" | "PUT", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const guest = (token: string, name = "Lili") => send("POST", "/api/family/guests", token, { name, color: "teal" });
const invite = (token: string, userId: string) => send("POST", "/api/family/invitations", token, { userId });
const accept = async (from: string, userId: string, token: string) =>
  send("POST", "/api/family/invitations/accept", token, { id: (await invite(from, userId)).json().id });
const setAccount = (userId: string, body: unknown) => send("PUT", `/api/admin/family/accounts/${userId}`, tokens.damien, body);
const refusal = (res: { statusCode: number; json: () => { code?: string } }) => [res.statusCode, res.json().code];

describe("par défaut, un compte ne crée rien", () => {
  it("ni famille (première invitation, premier invité) ni invité — dit en clair", async () => {
    expect(refusal(await invite(tokens.lea, IDS.hugo))).toEqual([403, "family.create_family_denied"]);
    expect(refusal(await guest(tokens.lea))).toEqual([403, "family.create_guests_denied"]);
    expect(h.state!.db.data.family).toHaveLength(0);
    const overview = (await get("/api/family", tokens.lea)).json();
    expect(overview.account.creation).toMatchObject({ createFamily: false, createGuests: false });
  });

  it("un administrateur Jellyfin peut toujours", async () => {
    expect((await guest(tokens.damien)).statusCode).toBe(200);
    expect((await invite(tokens.damien, IDS.lea)).statusCode).toBe(200);
    expect((await get("/api/family", tokens.damien)).json().account.creation).toMatchObject({ createFamily: true, createGuests: true });
  });
});

describe("le réglage d'un compte, et le défaut", () => {
  it("`allow` pour fonder une famille : il invite ; sans le droit des invités, pas d'invité", async () => {
    expect((await setAccount(IDS.lea, { createFamily: "allow" })).json()).toMatchObject({
      rights: { createFamily: "allow", createGuests: "inherit" },
      allowed: { createFamily: true, createGuests: false },
      isAdministrator: false,
      family: null,
      restrictedBy: null,
    });
    expect((await invite(tokens.lea, IDS.hugo)).statusCode).toBe(200);
    expect(refusal(await guest(tokens.lea))).toEqual([403, "family.create_guests_denied"]);
  });

  it("le défaut à OUI vaut pour `inherit`, jamais contre un `deny`", async () => {
    const res = await send("PUT", "/api/admin/family/creation", tokens.damien, { createFamily: true, createGuests: true });
    expect(res.json()).toMatchObject({ createFamily: true, createGuests: true });
    expect((await get("/api/admin/family/creation", tokens.damien)).json()).toMatchObject({ createFamily: true, createGuests: true });
    await setAccount(IDS.hugo, { createGuests: "deny" });
    expect((await guest(tokens.lea)).statusCode).toBe(200);
    expect(refusal(await guest(tokens.hugo, "Tom"))).toEqual([403, "family.create_guests_denied"]);
  });

  it("créer un invité exige le droit du compte ET, pour un membre, la permission du propriétaire", async () => {
    await accept(tokens.damien, IDS.lea, tokens.lea);
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: true });
    expect(refusal(await guest(tokens.lea))).toEqual([403, "family.create_guests_denied"]);
    await setAccount(IDS.lea, { createGuests: "allow" });
    expect((await guest(tokens.lea)).statusCode).toBe(200);
    await send("PUT", `/api/family/members/${IDS.lea}/rights`, tokens.damien, { createGuests: false });
    expect(refusal(await guest(tokens.lea, "Tom"))).toEqual([403, "family.guest_right_required"]);
  });

  it("les interrupteurs restent maîtres : coupés, personne — même `allow`", async () => {
    await setAccount(IDS.lea, { createFamily: "allow", createGuests: "allow" });
    await send("PUT", "/api/admin/family", tokens.damien, { guests: false });
    expect(refusal(await guest(tokens.lea))).toEqual([403, "family.guests_disabled"]);
    expect((await get(`/api/admin/family/accounts/${IDS.lea}`, tokens.damien)).json().allowed).toMatchObject({ createFamily: true, createGuests: false });
  });
});

describe("rétrocompatible : ce qui existe ne tombe pas", () => {
  it("une famille fondée avant reste ; son propriétaire invite encore, ses invités restent", async () => {
    h.state!.config.set("family_default_create_family", "true");
    h.state!.config.set("family_default_create_guests", "true");
    expect((await guest(tokens.lea)).statusCode).toBe(200);
    // L'administration referme après coup : rien ne tombe, seules les NOUVELLES créations se gardent.
    await send("PUT", "/api/admin/family/creation", tokens.damien, { createFamily: false, createGuests: false });
    const overview = (await get("/api/family", tokens.lea)).json();
    expect(overview.family.profiles.map((profile: { kind: string }) => profile.kind)).toEqual(["owner", "guest"]);
    expect((await invite(tokens.lea, IDS.hugo)).statusCode).toBe(200);
    expect(refusal(await guest(tokens.lea, "Tom"))).toEqual([403, "family.create_guests_denied"]);
    expect(overview.family.rights.createGuests).toBe(false);
  });
});

describe("les routes d'administration", () => {
  it("un administrateur en session personnelle seulement — jamais un compte ordinaire ni une TV", async () => {
    expect((await get("/api/admin/family/creation", tokens.lea)).statusCode).toBe(403);
    expect((await setAccount(IDS.lea, { createFamily: "allow" })).statusCode).toBe(200);
    expect((await send("PUT", `/api/admin/family/accounts/${IDS.hugo}`, tokens.lea, { createFamily: "allow" })).statusCode).toBe(403);
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await get("/api/admin/family/creation", pairing)).statusCode).toBe(401);
  });

  it("refuse une valeur inconnue, un compte inconnu de Jellyfin, un invité de la Famille", async () => {
    expect(refusal(await setAccount(IDS.lea, { createFamily: "maybe" }))).toEqual([400, "family.invalid_input"]);
    expect(refusal(await get(`/api/admin/family/accounts/${"ab".repeat(16)}`, tokens.damien))).toEqual([404, "family.not_found"]);
    const lili = (await guest(tokens.damien)).json().userId as string;
    expect(refusal(await setAccount(lili, { createFamily: "allow" }))).toEqual([403, "family.guest_account"]);
    expect((await get(`/api/admin/family/accounts/${lili}`, tokens.damien)).json()).toMatchObject({
      allowed: { createFamily: false, createGuests: false },
      family: { role: "guest", ownerName: "Damien", parent: false },
    });
  });

  it("dit la place d'un compte dans sa famille", async () => {
    await accept(tokens.damien, IDS.lea, tokens.lea);
    expect((await get(`/api/admin/family/accounts/${IDS.lea}`, tokens.damien)).json().family).toEqual({ role: "member", ownerName: "Damien", parent: false });
    expect((await get(`/api/admin/family/accounts/${IDS.damien}`, tokens.damien)).json()).toMatchObject({
      isAdministrator: true,
      allowed: { createFamily: true, createGuests: true },
      family: { role: "owner", ownerName: "Damien" },
    });
  });
});

describe("en direct : l'administration change ce que les comptes peuvent faire", () => {
  it("chaque compte connecté relit (`family:update` portée `settings`), un compte sans famille compris", async () => {
    h.state!.online = [IDS.damien, IDS.hugo];
    await send("PUT", "/api/admin/family", tokens.damien, { guests: false });
    const settings = () => h.state!.socket.filter((s) => s.msg.type === "family:update" && s.msg.scope === "settings").map((s) => s.userId);
    expect(settings().sort()).toEqual([IDS.damien, IDS.hugo].sort());
    h.state!.socket.length = 0;
    // Rien de changé : aucun avis.
    await send("PUT", "/api/admin/family", tokens.damien, { guests: false });
    expect(settings()).toEqual([]);
    await send("PUT", "/api/admin/family/creation", tokens.damien, { createFamily: false });
    expect(settings().sort()).toEqual([IDS.damien, IDS.hugo].sort());
  });
});
