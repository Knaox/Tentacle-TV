/**
 * « Qui regarde ? » sur le MOBILE (serveur 1.32.0, capacité `family.mobileProfiles`) :
 * les routes du bureau sous la plateforme `mobile` — la même famille, une session
 * de profil qui regarde et n'administre rien, son hôte à part (« Mobile » par
 * défaut), le PIN vérifié ici, et un téléphone à côté d'un bureau du même compte.
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

import { SERVER_CAPABILITIES } from "../src/serverCapabilities/serverCapabilities";
import { declaredServerCapabilities } from "../src/serverCapabilities/declaredCapabilities";
import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { IDS, bearer, resetCaches, seedUsers } from "./familyHarness";
import { buildPickerApp, door, pick, pickerProfiles, seedFamily, sender } from "./familyPickerHarness";

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

const hostsOf = (platform: string) => h.state!.db.data.pairedDevice.filter((row) => row.platform === platform && !row.parentId);

describe("le mobile", () => {
  it("le serveur déclare la capacité", () => {
    expect(SERVER_CAPABILITIES["family.mobileProfiles"]).toBe("1.32.0");
    expect(declaredServerCapabilities()).toContain("family.mobileProfiles");
  });

  it("liste la famille sous la plateforme mobile", async () => {
    await seedFamily(app, tokens);
    const res = await pickerProfiles(app, tokens.lea, "mobile");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ platform: "mobile", pickerRequired: true, currentProfileId: IDS.lea });
    expect(res.json().profiles).toHaveLength(3);
  });

  it("refuse une plateforme inconnue", async () => {
    const res = await send("GET", "/api/family/picker/profiles?platform=watch", tokens.damien);
    expect(res.statusCode).toBe(400);
  });

  it("un autre profil : une session de profil, hôte « Mobile », qui regarde et n'administre rien", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const res = await pick(app, tokens.damien, { profileId: zoe, platform: "mobile" });
    expect(res.statusCode).toBe(200);
    const picked = res.json();
    expect(picked).toMatchObject({ personal: false, user: { id: zoe } });
    expect((await door(app, picked.token)).user).toMatchObject({ userId: zoe, isAdmin: false, session: "tvProfile" });
    expect(hostsOf("mobile")).toEqual([expect.objectContaining({ jellyfinUserId: IDS.damien, name: "Mobile" })]);
    // Une session de profil : ni push ni « garder hors ligne » côté serveur.
    for (const path of ["/api/push/register", "/api/downloads/capabilities"]) {
      const denied = await app.inject({ method: "GET", url: path, headers: bearer(picked.token) });
      expect(denied.statusCode).toBe(403);
    }
    // Et jamais les routes de la session personnelle.
    expect((await pickerProfiles(app, picked.token, "mobile")).statusCode).toBe(403);
  });

  it("SON profil derrière SON PIN, vérifié par le serveur", async () => {
    expect((await send("PUT", "/api/family/pin", tokens.damien, { pin: "2468" })).statusCode).toBe(200);
    const missing = await pick(app, tokens.damien, { profileId: IDS.damien, platform: "mobile" });
    expect(missing.json().code).toBe("family.pin_required");
    const ok = await pick(app, tokens.damien, { profileId: IDS.damien, pin: "2468", platform: "mobile" });
    expect(ok.json().personal).toBe(true);
  });

  it("un téléphone et un bureau du même compte : deux hôtes, deux sessions", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const phoneToken = `${tokens.damien}-telephone`;
    h.state!.jf.personalTokens.set(phoneToken, IDS.damien);
    expect((await pick(app, tokens.damien, { profileId: IDS.lea })).statusCode).toBe(200);
    expect((await pick(app, phoneToken, { profileId: zoe, platform: "mobile", deviceName: "iPad de Damien" })).statusCode).toBe(200);
    expect(hostsOf("desktop")).toHaveLength(1);
    expect(hostsOf("mobile")).toEqual([expect.objectContaining({ name: "iPad de Damien" })]);
    expect((await pickerProfiles(app, tokens.damien)).json().currentProfileId).toBe(IDS.lea);
    expect((await pickerProfiles(app, phoneToken, "mobile")).json().currentProfileId).toBe(zoe);
  });
});
