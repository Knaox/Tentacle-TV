/**
 * Tests d'attaque T8 — Famille v2 PARTAGÉE : la TV d'un membre montre toute la
 * famille (SEC-F-35), les candidats v2 sont servis mais bornés (SEC-F-42), un
 * départ coupe les profils ÉTENDUS (SEC-F-43), et « Gérer les profils » sur la
 * TV d'un membre n'ouvre que SES droits derrière SON PIN (SEC-F-44).
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

const send = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as object });
const status = async (token: string) => (await send("GET", "/api/protected", token)).json();
const familyIdOf = () => h.state!.db.data.family[0].id as string;

/** Damien propriétaire, Léa membre, un invité Zoé. */
async function family(): Promise<{ zoe: string }> {
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId;
  return { zoe };
}
const tvOf = async (userId: string, name: string) => enroll(app, await pairTv(h.state!, userId, name));

describe("SEC-F-35 : la TV d'un MEMBRE montre toute la famille", () => {
  it("« Qui regarde ? » sur la TV de Léa liste le propriétaire, les membres et les invités", async () => {
    const { zoe } = await family();
    const leaTv = await tvOf(IDS.lea, "Léa");
    const listing = (await send("GET", "/api/family/tv/profiles", leaTv)).json();
    const byId = new Map(listing.profiles.map((p: { userId: string; kind: string }) => [p.userId, p.kind]));
    expect(byId.get(IDS.damien)).toBe("owner"); // le PROPRIÉTAIRE de la famille y figure
    expect(byId.get(IDS.lea)).toBe("member"); // le membre (celui qui a jumelé la TV)
    expect(byId.get(zoe)).toBe("guest"); // l'invité
    // `owner` de la réponse = le compte qui a jumelé la TV (Léa), pour l'étiquette.
    expect(listing.owner.userId).toBe(IDS.lea);
  });
});

describe("SEC-F-42 : candidats v2 servis — cachés listés, mais bornés", () => {
  it("un compte caché de l'écran de connexion est proposé, jamais un invité ni un désactivé", async () => {
    const { zoe } = await family();
    const list = async (q: string) =>
      (await send("GET", `/api/family/candidates?q=${encodeURIComponent(q)}`, tokens.damien)).json() as Array<{ userId: string; status: string }>;
    // « Caché » (IDS.cache) paraît sur une recherche partielle (v2).
    expect((await list("cach")).some((c) => c.userId === IDS.cache)).toBe(true);
    const all = (await send("GET", "/api/family/candidates", tokens.damien)).json() as Array<{ userId: string }>;
    const ids = all.map((c) => c.userId);
    expect(ids).not.toContain(zoe); // jamais un invité
    expect(ids).not.toContain(IDS.coupe); // jamais un désactivé
    expect(ids).not.toContain(IDS.damien); // jamais soi-même
    // Léa, déjà membre, paraît marquée (non invitable), jamais cachée.
    const lea = all.find((c) => (c as { userId: string }).userId === IDS.lea) as { status?: string } | undefined;
    expect(lea?.status).toBe("in_family");
  });
});

describe("SEC-F-43 : un départ coupe les profils de façon ÉTENDUE", () => {
  it("le partant perd les autres profils sur SA TV, et son profil tombe sur les TV des autres ; son compte reste", async () => {
    await family();
    const leaTv = await tvOf(IDS.lea, "Léa");
    const damienTv = await tvOf(IDS.damien, "Damien");
    // Sur la TV de Léa, on regarde le profil de DAMIEN (famille partagée).
    const onLeaTv = (await openProfile(app, leaTv, { profileId: IDS.damien })).json().token as string;
    // Sur la TV de Damien, le profil de LÉA est ouvert.
    const onDamienTv = (await openProfile(app, damienTv, { profileId: IDS.lea })).json().token as string;
    expect((await status(onLeaTv)).user.userId).toBe(IDS.damien);
    expect((await status(onDamienTv)).user.userId).toBe(IDS.lea);

    // Léa quitte la famille.
    expect((await send("POST", `/api/family/memberships/${familyIdOf()}/leave`, tokens.lea)).json()).toEqual({ left: true });

    // (a) sa TV perd TOUS les profils de la famille (même celui du propriétaire).
    expect((await status(onLeaTv)).profileEnded).toBe(true);
    // (b) les autres TV perdent LE profil du partant.
    expect((await status(onDamienTv)).profileEnded).toBe(true);
    // Son compte Jellyfin n'est jamais touché.
    expect(h.state!.jf.users.has(IDS.lea)).toBe(true);
  });
});

describe("SEC-F-44 : « Gérer les profils » sur la TV d'un membre = SES droits, SON PIN", () => {
  it("le PIN du membre ouvre sa gestion (droits de membre) ; les gestes du propriétaire restent refusés", async () => {
    const { zoe } = await family();
    await send("PUT", "/api/family/pin", tokens.lea, { pin: "1357" }); // Léa pose SON PIN
    const leaTv = await tvOf(IDS.lea, "Léa");
    const manage = (await openProfile(app, leaTv, { profileId: IDS.lea, pin: "1357" })).json().token as string;

    // La gestion est verrouillée tant que le PIN du membre n'est pas redonné.
    expect((await send("GET", "/api/family", manage)).json().code).toBe("family.manage_locked");
    const unlock = (pin?: string) => send("POST", "/api/family/tv/manage/unlock", manage, pin ? { pin } : {});
    expect((await unlock("9999")).json().code).toBe("family.pin_invalid"); // le PIN du propriétaire n'ouvre rien
    expect((await unlock("1357")).json().rights).toMatchObject({ manageMembers: false, manageGuests: "own" });

    // Déverrouillée, la session de Léa n'a QUE ses droits de membre.
    expect((await send("POST", "/api/family/invitations", manage, { userId: IDS.cache })).json().code).toBe("family.not_owner");
    expect((await send("DELETE", `/api/family/members/${IDS.damien}`, manage)).json().code).toBe("family.not_owner");
    expect((await send("PUT", `/api/family/members/${IDS.damien}/rights`, manage, { createGuests: true })).json().code).toBe("family.not_owner");
    // Et elle ne supprime pas l'invité d'un autre (créé par le propriétaire).
    expect((await send("DELETE", `/api/family/guests/${zoe}`, manage)).json().code).toBe("family.not_owner");
  });
});
