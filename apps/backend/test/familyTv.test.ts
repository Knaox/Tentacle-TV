/**
 * L'Apple TV et la Famille, de bout en bout par les vraies routes :
 * l'échange du jeton (et son rejeu), « Qui regarde ? », l'ouverture d'une
 * session de profil (une seule par TV), « Changer de profil », le
 * déjumelage — qui n'emporte jamais un invité.
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

const get = (url: string, token: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const profiles = async (pairing: string) => (await get("/api/family/tv/profiles", pairing)).json();
const addGuest = (name: string) =>
  app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(tokens.damien), payload: { name, color: "pink" } });

describe("l'échange du jeton de la TV", () => {
  it("le jeton d'avant ne vaut plus rien, le jeton de jumelage ne vaut que pour ses routes", async () => {
    const legacy = await pairTv(h.state!, IDS.damien, "Damien");
    expect((await get("/api/protected", legacy)).statusCode).toBe(200);
    const pairing = await enroll(app, legacy);

    const old = await get("/api/protected", legacy);
    expect(old.statusCode).toBe(401);
    expect(old.json().revoked).toBe(true);
    const asPairing = await get("/api/protected", pairing);
    expect(asPairing.statusCode).toBe(401);
    expect(asPairing.json().revoked).toBeUndefined();
    expect((await get("/api/family", pairing)).statusCode).toBe(401);

    const listing = await profiles(pairing);
    expect(listing.profiles.map((p: { userId: string; kind: string }) => [p.userId, p.kind])).toEqual([[IDS.damien, "owner"]]);
    expect(listing).toMatchObject({ pickerRequired: false, canManage: true, stickyProfileId: null });
  });

  it("une réponse perdue se rejoue, une fois — jusqu'au premier usage du nouveau jeton", async () => {
    const legacy = await pairTv(h.state!, IDS.damien, "Damien");
    const lost = await enroll(app, legacy);
    const kept = await enroll(app, legacy);
    expect(kept).not.toBe(lost);
    const refused = await get("/api/family/tv/profiles", lost);
    expect(refused.statusCode).toBe(401);
    expect(refused.json()).toMatchObject({ code: "family.pairing_required", revoked: true });
    expect((await get("/api/family/tv/profiles", kept)).statusCode).toBe(200);
    const replay = await app.inject({ method: "POST", url: "/api/family/tv/enroll", headers: bearer(legacy) });
    expect(replay.statusCode).toBe(401);
    expect(await enroll(app, kept)).toBe(kept);
  });

  it("une TV d'avant qui appelle trop tôt passe d'abord par l'échange", async () => {
    const legacy = await pairTv(h.state!, IDS.damien, "Damien");
    const res = await get("/api/family/tv/profiles", legacy);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("family.enroll_required");
  });
});

describe("« Qui regarde ? » et les sessions de profil", () => {
  it("montre la famille du propriétaire de la TV, et ouvre un profil comme son compte, jamais administrateur", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await addGuest("Zoé")).statusCode).toBe(200);
    const listing = await profiles(pairing);
    expect(listing.pickerRequired).toBe(true);
    const guest = listing.profiles.find((p: { kind: string }) => p.kind === "guest");
    expect(guest).toMatchObject({ name: "Zoé", color: "pink", hasPin: false, imageTag: null });

    const opened = await openProfile(app, pairing, { profileId: IDS.damien });
    expect(opened.statusCode).toBe(200);
    const session = opened.json();
    expect(session.user).toEqual({ id: IDS.damien, name: "Damien" });
    const me = (await get("/api/protected", session.token)).json().user;
    expect(me).toMatchObject({ userId: IDS.damien, isAdmin: false, session: "tvProfile" });
  });

  it("une seule session de profil par TV : la précédente se ferme", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    await addGuest("Zoé");
    const guestId = (await profiles(pairing)).profiles[1].userId;
    const first = (await openProfile(app, pairing, { profileId: IDS.damien })).json().token;
    const second = (await openProfile(app, pairing, { profileId: guestId })).json().token;
    const gone = await get("/api/protected", first);
    expect(gone.statusCode).toBe(401);
    expect(gone.json().profileEnded).toBe(true);
    expect(h.state!.ended.map(([, reason]) => reason)).toEqual(["replaced"]);
    expect((await get("/api/protected", second)).json().user.userId).toBe(guestId);
  });

  it("refuse un profil hors de la famille de la TV", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const res = await openProfile(app, pairing, { profileId: IDS.lea });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.profile_unavailable");
  });

  it("« Changer de profil » ferme la session seule ; la TV reste jumelée", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    const token = (await openProfile(app, pairing, { profileId: IDS.damien })).json().token;
    const res = await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: bearer(token) });
    expect(res.json()).toEqual({ revoked: true });
    expect((await get("/api/protected", token)).json().profileEnded).toBe(true);
    expect((await get("/api/family/tv/profiles", pairing)).statusCode).toBe(200);
  });

  it("déjumeler emporte la TV et ses sessions, jamais un invité", async () => {
    const pairing = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    await addGuest("Zoé");
    const guestId = (await profiles(pairing)).profiles[1].userId;
    const token = (await openProfile(app, pairing, { profileId: guestId })).json().token;
    expect((await app.inject({ method: "POST", url: "/api/pair/self/revoke", headers: bearer(pairing) })).statusCode).toBe(200);
    expect((await get("/api/protected", token)).json().profileEnded).toBe(true);
    expect(h.state!.ended).toContainEqual([expect.any(String), "unpaired"]);
    const after = await get("/api/family/tv/profiles", pairing);
    expect(after.statusCode).toBe(401);
    expect(after.json()).toMatchObject({ code: "family.pairing_required", revoked: true });
    expect(h.state!.jf.users.has(guestId)).toBe(true);
  });
});
