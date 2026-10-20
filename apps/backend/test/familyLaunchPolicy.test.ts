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
import { launchPolicyOf, normalizeLaunchSettings } from "../src/services/family/familyLaunchPolicy";

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

const ALL = { desktop: true, web: true, mobile: true, tv: true };
const DEFAULTS = { desktop: { mode: "choice", defaultOn: true }, tv: { mode: "choice" }, enabled: true, platforms: ALL };
const setPolicy = (body: unknown, token = tokens.damien) => send("PUT", "/api/admin/family/picker", token, body);
const tvListing = async (pairing: string) => (await sender(app)("GET", "/api/family/tv/profiles", pairing)).json();

describe("la politique de l'administration", () => {
  it("vaut ses défauts tant qu'elle n'est pas réglée ; illisible, aussi", async () => {
    expect((await send("GET", "/api/admin/family/picker", tokens.damien)).json()).toEqual(DEFAULTS);
    h.state!.config.set("family_launch_policy", "{pas du json");
    expect((await send("GET", "/api/admin/family/picker", tokens.damien)).json()).toEqual(DEFAULTS);
    expect(launchPolicyOf(normalizeLaunchSettings({ desktop: { mode: "parfois", defaultOn: "oui" }, tv: { defaultOn: false }, web: { mode: "off" } })))
      .toEqual(DEFAULTS);
    expect(normalizeLaunchSettings({ enabled: "oui", platforms: { desktop: false, tv: 1, montre: false } }))
      .toEqual({ enabled: true, platforms: { ...ALL, desktop: false } });
  });

  it("forme simple : ne change que ce qu'on lui envoie, garde les DEUX formes (un serveur ramené en arrière relit la sienne)", async () => {
    const res = await setPolicy({ platforms: { tv: false, mobile: false } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...DEFAULTS, tv: { mode: "off" }, platforms: { ...ALL, tv: false, mobile: false } });
    await setPolicy({ enabled: false });
    expect(JSON.parse(h.state!.config.get("family_launch_policy")!)).toEqual({
      desktop: { mode: "off", defaultOn: true },
      tv: { mode: "off" },
      enabled: false,
      platforms: { ...ALL, tv: false, mobile: false },
    });
    // Rallumé : les cases reviennent telles qu'elles étaient.
    expect((await setPolicy({ enabled: true })).json().platforms).toEqual({ ...ALL, tv: false, mobile: false });
  });

  it("forme d'avant (bureau d'avant la 1.31.1) : appliquée aux cases, les ordinateurs règlent aussi le navigateur", async () => {
    expect((await setPolicy({ tv: { mode: "off" } })).json().platforms).toEqual({ ...ALL, tv: false });
    expect((await setPolicy({ desktop: { defaultOn: false } })).json()).toMatchObject({
      desktop: { mode: "off", defaultOn: true },
      platforms: { desktop: false, web: false, mobile: true, tv: false },
    });
    await setPolicy({ enabled: false });
    // Permettre de nouveau rallume l'interrupteur général : sans quoi le geste ne se verrait pas.
    expect((await setPolicy({ desktop: { mode: "choice" } })).json()).toMatchObject({ enabled: true, platforms: { desktop: true, web: true } });
  });

  it("un administrateur en session personnelle seulement ; un corps mal formé : 400", async () => {
    expect((await send("GET", "/api/admin/family/picker", tokens.lea)).statusCode).toBe(403);
    expect((await setPolicy({ tv: { mode: "off" } }, tokens.lea)).statusCode).toBe(403);
    expect((await setPolicy({ enabled: false }, tokens.lea)).statusCode).toBe(403);
    const tv = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await send("GET", "/api/admin/family/picker", tv)).statusCode).toBeGreaterThanOrEqual(401);
    for (const body of [{ tv: { mode: "parfois" } }, { platforms: { montre: true } }, { platforms: { web: "oui" } }, { enabled: 1 }]) {
      const bad = await setPolicy(body);
      expect(bad.statusCode).toBe(400);
      expect(bad.json().code).toBe("family.invalid_input");
    }
    expect(h.state!.config.has("family_launch_policy")).toBe(false);
  });
});

describe("la reprise d'un réglage d'avant la 1.31.1", () => {
  const legacy = (value: unknown) => h.state!.config.set("family_launch_policy", JSON.stringify(value));
  const policy = async () => (await send("GET", "/api/admin/family/picker", tokens.damien)).json();

  it("permis et activé par défaut : tout coché", async () => {
    legacy({ desktop: { mode: "choice", defaultOn: true }, tv: { mode: "choice" } });
    expect(await policy()).toEqual(DEFAULTS);
  });

  it("bureau « pas activé par défaut » ou coupé : Ordinateurs ET Navigateur décochés, le mobile coché", async () => {
    legacy({ desktop: { mode: "choice", defaultOn: false }, tv: { mode: "choice" } });
    expect((await policy()).platforms).toEqual({ ...ALL, desktop: false, web: false });
    legacy({ desktop: { mode: "off", defaultOn: true }, tv: { mode: "off" } });
    expect(await policy()).toMatchObject({ enabled: true, platforms: { desktop: false, web: false, mobile: true, tv: false } });
  });

  it("les TV d'une politique d'avant coupée restent coupées (elles ouvrent le profil de leur compte)", async () => {
    legacy({ desktop: { mode: "choice", defaultOn: true }, tv: { mode: "off" } });
    const salon = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await tvListing(salon)).askAtLaunch).toBe(false);
  });
});

describe("« Qui regarde ? » de chaque plateforme", () => {
  it("`launchAsk` suit SA case et l'interrupteur général ; `atLaunch` et `launchPolicy` (bureaux d'avant) en sont tirés", async () => {
    await seedFamily(app, tokens);
    for (const platform of ["desktop", "web", "mobile"] as const) {
      expect((await pickerProfiles(app, tokens.lea, platform)).json())
        .toMatchObject({ launchAsk: true, atLaunch: true, launchPolicy: { mode: "choice", defaultOn: true } });
    }
    await setPolicy({ platforms: { web: false } });
    expect((await pickerProfiles(app, tokens.lea, "web")).json())
      .toMatchObject({ launchAsk: false, atLaunch: false, launchPolicy: { mode: "off", defaultOn: true } });
    expect((await pickerProfiles(app, tokens.lea, "desktop")).json().launchAsk).toBe(true);
    expect((await pickerProfiles(app, tokens.lea, "mobile")).json().launchAsk).toBe(true);
    await setPolicy({ enabled: false });
    for (const platform of ["desktop", "web", "mobile"] as const) {
      expect((await pickerProfiles(app, tokens.lea, platform)).json().launchAsk).toBe(false);
    }
    const salon = await enroll(app, await pairTv(h.state!, IDS.damien, "Damien"));
    expect((await tvListing(salon)).askAtLaunch).toBe(false);
  });

  it("décoché, « Changer de profil » reste : choisir un profil marche toujours", async () => {
    await seedFamily(app, tokens);
    await setPolicy({ platforms: { mobile: false } });
    expect((await pick(app, tokens.damien, { profileId: IDS.lea, platform: "mobile" })).statusCode).toBe(200);
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
