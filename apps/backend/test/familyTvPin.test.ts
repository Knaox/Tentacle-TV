/**
 * Le PIN des profils et « Gérer les profils », par les vraies routes : le
 * serveur seul compare (SEC-F-16), cinq essais puis blocage — même le bon PIN
 * échoue, et changer de TV n'y change rien (SEC-F-17) ; « Rester sur ce
 * profil » épargne le PIN jusqu'au prochain changement ; la gestion des
 * profils sur la TV exige le PIN du propriétaire (SEC-F-18).
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

const setPin = (token: string, pin: string | null) =>
  app.inject({ method: "PUT", url: "/api/family/pin", headers: bearer(token), payload: { pin } });
const tv = async () => enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));

describe("le PIN d'un profil", () => {
  it("est exigé, compté, puis bloque — même le bon PIN, sur toutes les TV", async () => {
    expect((await setPin(tokens.damien, "4242")).json()).toEqual({ hasPin: true });
    const salon = await tv();
    expect((await openProfile(app, salon, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "42" })).json().code).toBe("family.pin_format");
    for (let left = 4; left >= 1; left--) {
      const wrong = await openProfile(app, salon, { profileId: IDS.damien, pin: "0000" });
      expect(wrong.statusCode).toBe(403);
      expect(wrong.json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: left });
    }
    const locked = await openProfile(app, salon, { profileId: IDS.damien, pin: "0000" });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().lockedUntil).toBeTruthy();
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);

    const chambre = await tv();
    expect((await openProfile(app, chambre, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(423);
    const listing = (await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(chambre) })).json();
    expect(listing.profiles[0].lockedUntil).toBeTruthy();
  });

  it("ne sort jamais du serveur, ni en clair ni haché", async () => {
    await setPin(tokens.damien, "4242");
    const salon = await tv();
    const wrong = await openProfile(app, salon, { profileId: IDS.damien, pin: "1111" });
    const listing = await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(salon) });
    const overview = await app.inject({ method: "GET", url: "/api/family", headers: bearer(tokens.damien) });
    for (const body of [wrong.body, listing.body, overview.body]) {
      expect(body).not.toContain("4242");
      expect(body).not.toContain("scrypt");
    }
  });

  it("« Rester sur ce profil » rouvre sans PIN, jusqu'à un changement de PIN qui coupe tout", async () => {
    await setPin(tokens.damien, "4242");
    const salon = await tv();
    const first = await openProfile(app, salon, { profileId: IDS.damien, pin: "4242", remember: true });
    expect(first.json().remembered).toBe(true);
    const again = await openProfile(app, salon, { profileId: IDS.damien, remember: true });
    expect(again.statusCode).toBe(200);
    const token = again.json().token;

    await setPin(tokens.damien, "1357");
    const cut = await app.inject({ method: "GET", url: "/api/protected", headers: bearer(token) });
    expect(cut.json().profileEnded).toBe(true);
    expect(h.state!.ended).toContainEqual([expect.any(String), "pin_changed"]);
    const listing = (await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(salon) })).json();
    expect(listing.stickyProfileId).toBeNull();
    expect((await openProfile(app, salon, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
  });

  it("se pose en session personnelle seulement", async () => {
    const salon = await tv();
    const session = (await openProfile(app, salon, { profileId: IDS.damien })).json().token;
    const fromTv = await setPin(session, "4242");
    expect(fromTv.statusCode).toBe(403);
    expect(fromTv.json().code).toBe("family.personal_session_required");
  });
});

describe("« Gérer les profils » sur la TV", () => {
  it("est ouvert au propriétaire sans PIN, verrouillé par son PIN sinon", async () => {
    const salon = await tv();
    const open = (await openProfile(app, salon, { profileId: IDS.damien })).json().token;
    expect((await app.inject({ method: "GET", url: "/api/family", headers: bearer(open) })).statusCode).toBe(200);

    await setPin(tokens.damien, "4242");
    const session = (await openProfile(app, salon, { profileId: IDS.damien, pin: "4242" })).json().token;
    const locked = await app.inject({ method: "GET", url: "/api/family", headers: bearer(session) });
    expect(locked.statusCode).toBe(403);
    expect(locked.json().code).toBe("family.manage_locked");
    const unlock = (pin: string) => app.inject({ method: "POST", url: "/api/family/tv/manage/unlock", headers: bearer(session), payload: { pin } });
    expect((await unlock("9999")).json().code).toBe("family.pin_invalid");
    expect((await unlock("4242")).json().unlockedUntil).toBeTruthy();
    expect((await app.inject({ method: "GET", url: "/api/family", headers: bearer(session) })).statusCode).toBe(200);
    const guest = await app.inject({
      method: "POST", url: "/api/family/guests", headers: bearer(session), payload: { name: "Zoé", color: "teal" },
    });
    expect(guest.statusCode).toBe(200);
    // Jamais depuis la TV : dissoudre, le PIN d'un invité.
    const dissolve = await app.inject({ method: "DELETE", url: "/api/family", headers: bearer(session), payload: { confirm: "dissolve" } });
    expect(dissolve.json().code).toBe("family.personal_session_required");
  });

  it("est refusé au profil d'un invité, sur la TV comme ailleurs", async () => {
    const salon = await tv();
    await app.inject({ method: "POST", url: "/api/family/guests", headers: bearer(tokens.damien), payload: { name: "Zoé", color: "teal" } });
    const listing = (await app.inject({ method: "GET", url: "/api/family/tv/profiles", headers: bearer(salon) })).json();
    const guestSession = (await openProfile(app, salon, { profileId: listing.profiles[1].userId })).json().token;
    const res = await app.inject({ method: "POST", url: "/api/family/tv/manage/unlock", headers: bearer(guestSession), payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("family.not_owner");
    expect((await app.inject({ method: "GET", url: "/api/family", headers: bearer(guestSession) })).json().code).toBe("family.not_owner");
  });
});
