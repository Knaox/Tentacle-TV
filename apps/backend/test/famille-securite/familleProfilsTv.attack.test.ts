/**
 * Tests d'attaque T8 (phase 3) — PROFILS TV, jeton de JUMELAGE, PIN, contre
 * l'implémentation de T2. SEC-F-08/09 (un profil hors de la famille de la TV,
 * une autre TV), SEC-F-19 (le jeton de jumelage ne vaut pas session du
 * propriétaire), SEC-F-16/17/30 (PIN haché/compté/jamais rendu, verrou par
 * profil toutes TV), SEC-F-18 (« Gérer les profils » sous le PIN du propriétaire).
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

const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const setPin = (token: string, pin: string | null) =>
  app.inject({ method: "PUT", url: "/api/family/pin", headers: bearer(token), payload: { pin } });
const addGuest = (token: string, name: string, color = "pink") =>
  app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(token), payload: { name, color } });
/** La TV de Damien, passée aux profils. */
const damiensTv = async () => enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));

describe("SEC-F-19 : le jeton de jumelage « profils seuls » ne vaut pas session du propriétaire", () => {
  it("après l'échange : l'ancien jeton meurt, le jeton de jumelage n'ouvre que lister/ouvrir", async () => {
    const legacy = await pairTv(h.state!, IDS.damien, "Damien");
    expect((await get("/api/protected", legacy)).statusCode).toBe(200); // avant l'échange, c'était une session
    const pairing = await enroll(app, legacy);

    // L'ancien jeton est révoqué (la TV se re-jumelle si on le présente).
    const old = await get("/api/protected", legacy);
    expect(old.statusCode).toBe(401);
    expect(old.json().revoked).toBe(true);
    // Le jeton de jumelage NE donne aucune session de compte ni l'état famille.
    expect((await get("/api/protected", pairing)).statusCode).toBe(401);
    expect((await get("/api/family", pairing)).statusCode).toBe(401);
    // Il ne sert QU'À lister les profils.
    expect((await get("/api/family/tv/profiles", pairing)).statusCode).toBe(200);
  });
});

describe("SEC-F-08/09 : une TV n'ouvre que les profils de SA famille", () => {
  it("ouvrir un profil hors de la famille de la TV → 403 family.profile_unavailable, aucun jeton", async () => {
    const pairing = await damiensTv();
    const res = await openProfile(app, pairing, { profileId: IDS.lea }); // Léa n'est pas dans la famille de Damien
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.profile_unavailable");
    expect(res.json().token).toBeUndefined();
  });

  it("une AUTRE TV (jumelée par Léa) ne peut ouvrir le profil de Damien", async () => {
    await damiensTv(); // la famille de Damien existe
    const leaTv = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa"));
    // La TV de Léa ne liste que Léa, et refuse le profil de Damien.
    const listing = (await get("/api/family/tv/profiles", leaTv)).json();
    expect(listing.profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.lea]);
    const res = await openProfile(app, leaTv, { profileId: IDS.damien });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.profile_unavailable");
  });
});

describe("SEC-F-16/17/30 : le PIN est haché/compté par le serveur, jamais rendu", () => {
  it("cinq essais puis blocage — même le bon PIN, et le compteur suit le profil sur toutes les TV", async () => {
    expect((await setPin(tokens.damien, "4242")).json()).toEqual({ hasPin: true });
    const salon = await damiensTv();
    expect((await openProfile(app, salon, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "42" })).json().code).toBe("family.pin_format");
    for (let left = 4; left >= 1; left--) {
      const wrong = await openProfile(app, salon, { profileId: IDS.damien, pin: "0000" });
      expect(wrong.statusCode).toBe(403);
      expect(wrong.json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: left });
    }
    const locked = await openProfile(app, salon, { profileId: IDS.damien, pin: "0000" });
    expect(locked.statusCode).toBe(423);
    // Le bon PIN est refusé pendant le verrou.
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);
    // Une autre TV ne remet pas le compteur à zéro (verrou par profil).
    const chambre = await damiensTv();
    expect((await openProfile(app, chambre, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);
    expect((await get("/api/family/tv/profiles", chambre)).json().profiles[0].lockedUntil).toBeTruthy();
  });

  it("le PIN ne sort jamais du serveur — ni en clair, ni haché, nulle part", async () => {
    await setPin(tokens.damien, "4242");
    const salon = await damiensTv();
    const bad = await openProfile(app, salon, { profileId: IDS.damien, pin: "1111" });
    const listing = await get("/api/family/tv/profiles", salon);
    const ov = await get("/api/family", tokens.damien);
    for (const body of [bad.body, listing.body, ov.body]) {
      expect(body).not.toContain("4242");
      expect(body).not.toMatch(/scrypt|\$2[aby]\$|pinHash/i);
    }
    // La réponse d'un PIN faux ne révèle que le nombre d'essais restants.
    expect(bad.json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: 4 });
    expect(bad.json().pin).toBeUndefined();
  });
});

describe("SEC-F-18 : « Gérer les profils » sur la TV exige le PIN du propriétaire", () => {
  it("fermé sans PIN validé ; un profil d'invité n'y accède jamais", async () => {
    const salon = await damiensTv();
    await setPin(tokens.damien, "4242");
    await addGuest(tokens.damien, "Zoé"); // devient candidat au focus, mais on garde la gestion fermée
    // Le propriétaire a ouvert son profil avec son PIN, mais « Gérer » reste verrouillé.
    const owner = (await openProfile(app, salon, { profileId: IDS.damien, pin: "4242" })).json().token;
    expect((await get("/api/family", owner)).json().code).toBe("family.manage_locked");
    const unlock = (pin: string) => app.inject({ method: "POST", url: "/api/family/tv/manage/unlock", headers: bearer(owner), payload: { pin } });
    expect((await unlock("9999")).json().code).toBe("family.pin_invalid");
    expect((await unlock("4242")).json().unlockedUntil).toBeTruthy();
    expect((await get("/api/family", owner)).statusCode).toBe(200);

    // Un profil d'invité n'ouvre jamais la gestion, PIN ou pas.
    const guestId = (await get("/api/family/tv/profiles", salon)).json().profiles.find((p: { kind: string }) => p.kind === "guest").userId;
    const guest = (await openProfile(app, salon, { profileId: guestId })).json().token;
    expect((await app.inject({ method: "POST", url: "/api/family/tv/manage/unlock", headers: bearer(guest), payload: {} })).json().code).toBe("family.not_owner");
    expect((await get("/api/family", guest)).json().code).toBe("family.not_owner");
  });
});
