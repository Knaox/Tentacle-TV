/**
 * « Qui regarde ? » à l'ouverture réglé par l'ADMINISTRATION, plateforme par
 * plateforme, par les vraies routes : le bureau reçoit son cadre (permis,
 * activé par défaut) — il décide ensuite par appareil ; les TV coupées
 * ouvrent le profil du compte qui les a jumelées, sans PIN — lui seul.
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
import { buildPickerApp, pick, pickerProfiles, seedFamily, sender } from "./familyPickerHarness";
import { normalizeLaunchPolicy } from "../src/services/family/familyLaunchPolicy";

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

const DEFAULTS = { desktop: { mode: "choice", defaultOn: true }, tv: { mode: "choice" } };
const setPolicy = (body: unknown, token = tokens.damien) => send("PUT", "/api/admin/family/picker", token, body);
const tvListing = async (pairing: string) => (await sender(app)("GET", "/api/family/tv/profiles", pairing)).json();

describe("la politique de l'administration", () => {
  it("vaut ses défauts tant qu'elle n'est pas réglée ; illisible, aussi", async () => {
    expect((await send("GET", "/api/admin/family/picker", tokens.damien)).json()).toEqual(DEFAULTS);
    h.state!.config.set("family_launch_policy", "{pas du json");
    expect((await send("GET", "/api/admin/family/picker", tokens.damien)).json()).toEqual(DEFAULTS);
    expect(normalizeLaunchPolicy({ desktop: { mode: "parfois", defaultOn: "oui" }, tv: { defaultOn: false }, web: { mode: "off" } })).toEqual(DEFAULTS);
  });

  it("ne change que ce qu'on lui envoie, et le garde", async () => {
    const res = await setPolicy({ tv: { mode: "off" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...DEFAULTS, tv: { mode: "off" } });
    await setPolicy({ desktop: { defaultOn: false } });
    expect(JSON.parse(h.state!.config.get("family_launch_policy")!)).toEqual({
      desktop: { mode: "choice", defaultOn: false },
      tv: { mode: "off" },
    });
  });

  it("un administrateur en session personnelle seulement ; un corps mal formé : 400", async () => {
    expect((await send("GET", "/api/admin/family/picker", tokens.lea)).statusCode).toBe(403);
    expect((await setPolicy({ tv: { mode: "off" } }, tokens.lea)).statusCode).toBe(403);
    const tv = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await send("GET", "/api/admin/family/picker", tv)).statusCode).toBeGreaterThanOrEqual(401);
    const bad = await setPolicy({ tv: { mode: "parfois" } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe("family.invalid_input");
    expect(h.state!.config.has("family_launch_policy")).toBe(false);
  });
});

describe("le cadre du bureau", () => {
  it("rendu à « Qui regarde ? » ; `atLaunch` (bureaux d'avant) = permis ET activé par défaut", async () => {
    await seedFamily(app, tokens);
    expect((await pickerProfiles(app, tokens.lea)).json()).toMatchObject({ atLaunch: true, launchPolicy: DEFAULTS.desktop });
    await setPolicy({ desktop: { defaultOn: false } });
    expect((await pickerProfiles(app, tokens.lea)).json()).toMatchObject({ atLaunch: false, launchPolicy: { mode: "choice", defaultOn: false } });
    await setPolicy({ desktop: { mode: "off", defaultOn: true } });
    expect((await pickerProfiles(app, tokens.lea)).json()).toMatchObject({ atLaunch: false, launchPolicy: { mode: "off", defaultOn: true } });
  });

  it("l'ancienne préférence du compte n'y change plus rien", async () => {
    await send("PUT", "/api/family/picker/preference", tokens.damien, { platform: "desktop", atLaunch: false });
    expect((await pickerProfiles(app, tokens.damien)).json().atLaunch).toBe(true);
  });
});

describe("sur la TV", () => {
  const pinOf = (token: string, pin: string) => send("PUT", "/api/family/pin", token, { pin });

  it("permis (défaut) : « Qui regarde ? », le PIN du compte de la TV reste exigé", async () => {
    await pinOf(tokens.damien, "4242");
    const salon = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await tvListing(salon)).askAtLaunch).toBe(true);
    expect((await openProfile(app, salon, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
  });

  it("coupé : chaque TV ouvre le profil de SON compte sans PIN, jamais un autre ; un PIN envoyé se vérifie", async () => {
    await seedFamily(app, tokens);
    await pinOf(tokens.damien, "4242");
    await pinOf(tokens.lea, "1234");
    await setPolicy({ tv: { mode: "off" } });
    const salon = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await tvListing(salon)).askAtLaunch).toBe(false);
    expect((await openProfile(app, salon, { profileId: IDS.damien })).statusCode).toBe(200);
    expect((await openProfile(app, salon, { profileId: IDS.lea })).json().code).toBe("family.pin_required");
    // « Changer de profil » demande le code : envoyé, il se vérifie toujours.
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "0000" })).json().code).toBe("family.pin_invalid");
    expect((await openProfile(app, salon, { profileId: IDS.damien, pin: "4242" })).statusCode).toBe(200);
    // La TV de Léa ouvre SON profil, à elle.
    const chambre = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa"));
    expect((await openProfile(app, chambre, { profileId: IDS.lea })).statusCode).toBe(200);
    expect((await openProfile(app, chambre, { profileId: IDS.damien })).json().code).toBe("family.pin_required");
  });

  it("coupé : un profil bloqué ne s'ouvre pas", async () => {
    await pinOf(tokens.lea, "1234");
    await setPolicy({ tv: { mode: "off" } });
    const chambre = await enroll(app, await pairTv(h.state!, IDS.lea, "Léa"));
    // Cinq essais ratés ailleurs (son bureau) : le profil est bloqué, pour toutes les portes.
    for (let i = 0; i < 5; i++) await pick(app, tokens.lea, { profileId: IDS.lea, pin: "0000" });
    expect((await openProfile(app, chambre, { profileId: IDS.lea })).statusCode).toBe(423);
  });
});
