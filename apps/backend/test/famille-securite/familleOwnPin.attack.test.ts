/**
 * Tests d'attaque T8 — « son propre PIN » depuis une session de profil TV
 * (v2, setOwnPin ouvert à `tvProfile`). Changer/retirer un PIN existant exige
 * le PIN courant, vérifié avec le MÊME compteur et le MÊME blocage que
 * l'ouverture d'un profil. L'acteur est TOUJOURS la session.
 *
 * Attaques : currentPin absent/faux (refus, essai compté), brute force par ce
 * chemin (blocage PARTAGÉ avec l'ouverture), un invité, un userId glissé dans
 * le corps, le jeton de jumelage, le compte de démonstration.
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

const setPin = (token: string, body: unknown) => app.inject({ method: "PUT", url: "/api/family/pin", headers: bearer(token), payload: body as object });
const open = (pairing: string, body: Record<string, unknown>) => openProfile(app, pairing, body);
const damiensTv = async () => enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
/** Damien a un PIN (posé en session personnelle), et une session de profil sur sa TV. */
async function ownerWithPinSession(): Promise<{ pairing: string; session: string }> {
  expect((await setPin(tokens.damien, { pin: "4242" })).json()).toEqual({ hasPin: true }); // premier PIN : pas de currentPin
  const pairing = await damiensTv();
  const session = (await open(pairing, { profileId: IDS.damien, pin: "4242" })).json().token as string;
  return { pairing, session };
}

describe("changer son PIN depuis une TV exige le PIN courant", () => {
  it("currentPin absent → refusé (pin_required) ; faux → refusé (pin_invalid) et l'essai est compté", async () => {
    const { session } = await ownerWithPinSession();
    expect((await setPin(session, { pin: "1111" })).json().code).toBe("family.pin_required"); // pas de currentPin
    const wrong = await setPin(session, { pin: "1111", currentPin: "0000" });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: 4 }); // compté
    // Le bon PIN courant change bien le code.
    expect((await setPin(session, { pin: "1111", currentPin: "4242" })).json()).toEqual({ hasPin: true });
  });

  it("brute force par ce chemin → blocage PARTAGÉ avec l'ouverture du profil", async () => {
    const { pairing, session } = await ownerWithPinSession();
    for (let left = 4; left >= 1; left--) {
      expect((await setPin(session, { pin: "1111", currentPin: "0000" })).json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: left });
    }
    expect((await setPin(session, { pin: "1111", currentPin: "0000" })).statusCode).toBe(423); // bloqué
    // Le MÊME blocage ferme l'ouverture d'un profil (compteur partagé par profil).
    expect((await open(pairing, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);
  });
});

describe("son PIN : qui peut, qui ne peut pas", () => {
  it("un invité ne pose jamais son propre PIN (guest_account)", async () => {
    const pairing = await damiensTv();
    const guestId = (await app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(tokens.damien), payload: { name: "Zoé", color: "teal" } })).json().userId;
    const guestSession = (await open(pairing, { profileId: guestId })).json().token as string;
    expect((await setPin(guestSession, { pin: "1234" })).json().code).toBe("family.guest_account");
  });

  it("l'acteur est la SESSION : un userId glissé dans le corps est ignoré", async () => {
    await setPin(tokens.damien, { pin: "4242" }); // Damien a un PIN
    // Léa (autre profil, sans PIN) tente de viser Damien par le corps : elle ne
    // change que SON propre PIN ; celui de Damien reste intact.
    const res = await setPin(tokens.lea, { pin: "9999", userId: IDS.damien, currentUserId: IDS.damien });
    expect(res.json()).toEqual({ hasPin: true });
    expect(h.state!.db.data.profilePin.some((p) => p.userId === IDS.lea)).toBe(true); // Léa a un PIN
    // Le PIN de Damien n'a pas bougé : son ouverture de profil l'exige toujours à 4242.
    const pairing = await damiensTv();
    expect((await open(pairing, { profileId: IDS.damien, pin: "9999" })).json().code).toBe("family.pin_invalid");
    expect((await open(pairing, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(200);
  });

  it("le jeton de jumelage ne pose aucun PIN (401 — pas un appelant de setOwnPin)", async () => {
    const pairing = await damiensTv();
    expect((await setPin(pairing, { pin: "1234" })).statusCode).toBe(401);
  });

  it("le compte de démonstration ne pose aucun PIN (review_account)", async () => {
    await h.state!.db.client.provisioningCode.create({ data: { code: "X".repeat(12), jellyfinUserId: IDS.demo, username: "Demo" } });
    resetCaches();
    expect((await setPin(tokens.demo, { pin: "1234" })).json().code).toBe("family.review_account");
  });
});

describe("cascade : la session qui agit garde la sienne", () => {
  it("depuis une TV, changer le PIN coupe les AUTRES sessions du profil, jamais celle qui agit", async () => {
    await setPin(tokens.damien, { pin: "4242" });
    const tvA = await damiensTv();
    const tvB = await damiensTv();
    const acting = (await open(tvA, { profileId: IDS.damien, pin: "4242" })).json().token as string;
    const other = (await open(tvB, { profileId: IDS.damien, pin: "4242" })).json().token as string;
    expect((await setPin(acting, { pin: "1357", currentPin: "4242" })).json()).toEqual({ hasPin: true });
    const probe = async (t: string) => (await app.inject({ method: "GET", url: "/api/protected", headers: bearer(t) })).json();
    expect((await probe(acting)).user?.userId).toBe(IDS.damien); // la session qui agit reste
    expect((await probe(other)).profileEnded).toBe(true); // l'autre tombe
  });
});
