/**
 * « Qui regarde ? » sur le BUREAU, de bout en bout par les vraies routes : la
 * liste (la famille du compte, comme sur sa TV), le choix d'un AUTRE profil
 * (une session de profil, une seule par appareil, jamais administratrice), le
 * retour à SON profil derrière SON PIN (aucun jeton), le compteur de PIN
 * partagé avec les TV, les interrupteurs, deux bureaux du même compte.
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
import { IDS, enroll, openProfile, pairTv, resetCaches, seedUsers } from "./familyHarness";
import { buildPickerApp, door, pick, pickSession, pickerProfiles, seedFamily, sender } from "./familyPickerHarness";

let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;
let send: ReturnType<typeof sender>;

beforeAll(async () => {
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildPickerApp();
  send = sender(app);
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

const listing = async (token: string) => (await pickerProfiles(app, token)).json();
const hosts = () => h.state!.db.data.pairedDevice.filter((row) => row.platform === "desktop");

describe("la liste du bureau", () => {
  it("un compte sans famille : lui seul, son profil, rien à choisir, préférence coupée", async () => {
    const res = await pickerProfiles(app, tokens.damien);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      v: 2,
      platform: "desktop",
      account: { userId: IDS.damien, name: "Damien" },
      currentProfileId: IDS.damien,
      pickerRequired: false,
      atLaunch: false,
    });
    expect(res.json().profiles).toEqual([
      expect.objectContaining({ userId: IDS.damien, kind: "owner", personal: true, hasPin: false, lockedUntil: null }),
    ]);
    expect(hosts()).toHaveLength(0);
  });

  it("montre la famille du compte comme sa TV : le propriétaire, les membres, les invités", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const mine = await listing(tokens.lea);
    expect(mine.pickerRequired).toBe(true);
    expect(mine.profiles.map((p: { userId: string; kind: string; personal: boolean }) => [p.userId, p.kind, p.personal])).toEqual([
      [IDS.damien, "owner", false],
      [IDS.lea, "member", true],
      [zoe, "guest", false],
    ]);
    expect(mine.profiles[2]).toMatchObject({ name: "Zoé", color: "teal", imageTag: null, createdBy: IDS.damien });
    expect(JSON.stringify(mine)).not.toMatch(/pinHash|scrypt/);
  });
});

describe("choisir un profil", () => {
  it("un autre profil : une session de profil à son nom, JAMAIS administratrice", async () => {
    await seedFamily(app, tokens);
    const res = await pick(app, tokens.lea, { profileId: IDS.damien });
    expect(res.statusCode).toBe(200);
    const picked = res.json();
    expect(picked).toMatchObject({ personal: false, user: { id: IDS.damien, name: "Damien" }, profile: { kind: "owner", personal: false } });
    // Damien est administrateur de Jellyfin : la session de son profil ne l'est pas.
    expect((await door(app, picked.token)).user).toMatchObject({ userId: IDS.damien, isAdmin: false, session: "tvProfile" });
    expect((await listing(tokens.lea)).currentProfileId).toBe(IDS.damien);
    const [host] = hosts();
    expect(host).toMatchObject({ jellyfinUserId: IDS.lea, parentId: null, name: "Desktop" });
    expect(h.state!.db.data.pairedDevice.filter((row) => row.parentId === host.id)).toHaveLength(1);
  });

  it("une seule session de profil par appareil : la précédente se ferme", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const first = await pickSession(app, tokens.damien, IDS.lea);
    const second = await pickSession(app, tokens.damien, zoe);
    expect(await door(app, first)).toMatchObject({ status: 401, ended: true });
    expect(h.state!.ended.map(([, reason]) => reason)).toEqual(["replaced"]);
    expect((await door(app, second)).user).toMatchObject({ userId: zoe, isAdmin: false });
    expect((await listing(tokens.damien)).currentProfileId).toBe(zoe);
  });

  it("SON profil : la session personnelle reprend, sans jeton ; la session de profil se ferme", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const guest = await pickSession(app, tokens.damien, zoe);
    const res = await pick(app, tokens.damien, { profileId: IDS.damien });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ personal: true, profile: expect.objectContaining({ userId: IDS.damien, personal: true }) });
    expect(res.json().token).toBeUndefined();
    expect(await door(app, guest)).toMatchObject({ status: 401, ended: true });
    expect(h.state!.ended.map(([, reason]) => reason)).toEqual(["closed"]);
    expect((await listing(tokens.damien)).currentProfileId).toBe(IDS.damien);
    // La session personnelle n'a jamais cessé.
    expect((await door(app, tokens.damien)).user).toMatchObject({ userId: IDS.damien, session: "personal" });
  });

  it("SON profil derrière SON PIN : exigé, compté, puis accepté", async () => {
    expect((await send("PUT", "/api/family/pin", tokens.damien, { pin: "2468" })).statusCode).toBe(200);
    const missing = await pick(app, tokens.damien, { profileId: IDS.damien });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().code).toBe("family.pin_required");
    const wrong = await pick(app, tokens.damien, { profileId: IDS.damien, pin: "0000" });
    expect(wrong.json()).toMatchObject({ code: "family.pin_invalid", attemptsLeft: 4 });
    expect((await pick(app, tokens.damien, { profileId: IDS.damien, pin: "2468" })).json().personal).toBe(true);
    expect(JSON.stringify(wrong.json())).not.toContain("2468");
  });

  it("le compteur de PIN est celui des TV : trois essais ici, deux sur la TV, et le profil se bloque partout", async () => {
    const { zoe } = await seedFamily(app, tokens);
    expect((await send("PUT", `/api/family/guests/${zoe}/pin`, tokens.damien, { pin: "1357" })).statusCode).toBe(200);
    for (let i = 0; i < 3; i++) expect((await pick(app, tokens.damien, { profileId: zoe, pin: "9999" })).json().code).toBe("family.pin_invalid");
    const tv = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await openProfile(app, tv, { profileId: zoe, pin: "9999" })).json()).toMatchObject({ attemptsLeft: 1 });
    expect((await openProfile(app, tv, { profileId: zoe, pin: "9999" })).json().code).toBe("family.pin_locked");
    const locked = await pick(app, tokens.damien, { profileId: zoe, pin: "1357" });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().lockedUntil).toBeTruthy();
    const zoeListed = (await listing(tokens.damien)).profiles.find((p: { userId: string }) => p.userId === zoe);
    expect(zoeListed.lockedUntil).toBeTruthy();
  });

  it("refuse un profil hors de sa famille, sans rien créer", async () => {
    await seedFamily(app, tokens);
    for (const profileId of [IDS.hugo, IDS.coupe, "f".repeat(32)]) {
      const res = await pick(app, tokens.damien, { profileId });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("family.profile_unavailable");
    }
    expect(h.state!.db.data.pairedDevice).toHaveLength(0);
  });

  it("suit les interrupteurs : Familles coupées, le compte seul ; invités coupés, sans invité", async () => {
    const { zoe } = await seedFamily(app, tokens);
    await send("PUT", "/api/admin/family", tokens.damien, { guests: false });
    expect((await listing(tokens.damien)).profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.damien, IDS.lea]);
    expect((await pick(app, tokens.damien, { profileId: zoe })).json().code).toBe("family.guests_disabled");
    await send("PUT", "/api/admin/family", tokens.damien, { families: false });
    expect((await listing(tokens.damien)).profiles.map((p: { userId: string }) => p.userId)).toEqual([IDS.damien]);
    expect((await pick(app, tokens.damien, { profileId: IDS.lea })).json().code).toBe("family.disabled");
    expect((await pick(app, tokens.damien, { profileId: IDS.damien })).json().personal).toBe(true);
  });

  it("deux bureaux du même compte : deux hôtes, chacun sa session de profil", async () => {
    const { zoe } = await seedFamily(app, tokens);
    // Le même compte connecté sur un second ordinateur : un autre jeton personnel.
    const laptopToken = `${tokens.damien}-portable`;
    h.state!.jf.personalTokens.set(laptopToken, IDS.damien);
    const office = await pickSession(app, tokens.damien, zoe);
    const laptop = await pickSession(app, laptopToken, IDS.lea);
    expect(hosts()).toHaveLength(2);
    expect((await door(app, office)).status).toBe(200);
    expect((await door(app, laptop)).status).toBe(200);
    expect((await listing(tokens.damien)).currentProfileId).toBe(zoe);
    expect((await listing(laptopToken)).currentProfileId).toBe(IDS.lea);
  });

  it("le nom de l'appareil est nettoyé, borné, et « Desktop » par défaut", async () => {
    const { zoe } = await seedFamily(app, tokens);
    await pick(app, tokens.damien, { profileId: zoe, deviceName: "  Mac\u0000 de​   Damien\n" + "x".repeat(100) });
    const name = hosts()[0].name as string;
    expect(name.startsWith("Mac de Damien x")).toBe(true);
    expect(Array.from(name).length).toBeLessThanOrEqual(64);
  });
});
