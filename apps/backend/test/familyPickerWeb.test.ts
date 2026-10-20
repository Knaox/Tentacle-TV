/**
 * « Qui regarde ? » dans le NAVIGATEUR (serveur 1.32.0, capacité `family.webProfiles`) :
 * le web s'authentifie par cookie (`tentacle_token`, qui l'emporte sur tout Bearer).
 * Ouvrir le profil d'un autre réécrit donc les cookies — le profil devient la session,
 * le jeton du compte part en RÉSERVE httpOnly (`tentacle_account_token`), jamais lisible
 * par la page — et ne revient qu'en choisissant SON profil derrière SON code. Une
 * réserve ne remplace jamais une session personnelle ; la déconnexion l'emporte.
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
import { IDS, resetCaches, seedUsers } from "./familyHarness";
import { buildPickerApp, seedFamily, sender } from "./familyPickerHarness";

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

type Jar = Record<string, string>;
type Method = "GET" | "POST" | "PUT";

/** Une requête du navigateur : ses cookies, aucun Bearer. */
function browser(method: Method, url: string, jar: Jar, payload?: unknown) {
  return app.inject({ method, url, cookies: jar, ...(payload !== undefined && { payload: payload as object }) });
}

/** Les cookies posés par une réponse, appliqués au bocal (une valeur vide efface). */
function applied(jar: Jar, res: { cookies: { name: string; value: string; httpOnly?: boolean }[] }): Jar {
  const next = { ...jar };
  for (const cookie of res.cookies) {
    if (cookie.value) next[cookie.name] = cookie.value;
    else delete next[cookie.name];
  }
  return next;
}

const webPick = (jar: Jar, body: { profileId: string; pin?: string }) =>
  browser("POST", "/api/family/picker/sessions", jar, { platform: "web", ...body });
const webProfiles = (jar: Jar) => browser("GET", "/api/family/picker/profiles?platform=web", jar);
const whoAmI = async (jar: Jar) => (await browser("GET", "/api/protected", jar)).json() as { user?: { userId: string }; profileEnded?: boolean };

/** Damien ouvre la session de Zoé depuis son navigateur. */
async function inZoe() {
  const { zoe } = await seedFamily(app, tokens);
  const res = await webPick({ tentacle_token: tokens.damien }, { profileId: zoe });
  expect(res.statusCode).toBe(200);
  return { zoe, res, jar: applied({ tentacle_token: tokens.damien }, res), profileToken: res.json().token as string };
}

describe("le web : la capacité et la plateforme", () => {
  it("le serveur déclare la capacité", () => {
    expect(SERVER_CAPABILITIES["family.webProfiles"]).toBe("1.32.0");
    expect(declaredServerCapabilities()).toContain("family.webProfiles");
  });

  it("liste la famille sous la plateforme web, par le cookie de session", async () => {
    await seedFamily(app, tokens);
    const res = await webProfiles({ tentacle_token: tokens.damien });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ platform: "web", pickerRequired: true, currentProfileId: IDS.damien });
  });
});

describe("le web : entrer dans le profil d'un autre", () => {
  it("le profil devient la session, le compte part en réserve httpOnly — hôte « Web »", async () => {
    const { zoe, jar, profileToken, res } = await inZoe();
    expect(jar.tentacle_token).toBe(profileToken);
    expect(jar.tentacle_account_token).toBe(tokens.damien);
    for (const cookie of res.cookies) expect(cookie.httpOnly).toBe(true);
    // Toute porte voit Zoé : le cookie du profil l'emporte, même devant le Bearer du compte.
    expect((await whoAmI(jar)).user?.userId).toBe(zoe);
    const withBearer = await app.inject({ method: "GET", url: "/api/protected", cookies: jar, headers: { authorization: `Bearer ${tokens.damien}` } });
    expect(withBearer.json().user.userId).toBe(zoe);
    const host = h.state!.db.data.pairedDevice.find((row) => row.platform === "web" && !row.parentId);
    expect(host).toMatchObject({ jellyfinUserId: IDS.damien, name: "Web" });
  });

  it("pendant le profil, « Qui regarde ? » se joue par la réserve, sans jeton dans la page", async () => {
    const { zoe, jar } = await inZoe();
    const res = await webProfiles(jar);
    expect(res.statusCode).toBe(200);
    expect(res.json().currentProfileId).toBe(zoe);
    // Sans réserve, la session de profil n'y a pas droit.
    expect((await webProfiles({ tentacle_token: jar.tentacle_token })).statusCode).toBe(403);
  });

  it("revenir à SON profil exige SON code ; le jeton du compte revient alors, la réserve s'efface", async () => {
    expect((await send("PUT", "/api/family/pin", tokens.damien, { pin: "2468" })).statusCode).toBe(200);
    const { zoe } = await seedFamily(app, tokens);
    const opened = await webPick({ tentacle_token: tokens.damien }, { profileId: zoe, pin: undefined });
    const jar = applied({ tentacle_token: tokens.damien }, opened);
    const missing = await webPick(jar, { profileId: IDS.damien });
    expect(missing.json().code).toBe("family.pin_required");
    expect(missing.cookies).toHaveLength(0);
    const wrong = await webPick(jar, { profileId: IDS.damien, pin: "0000" });
    expect(wrong.json().code).toBe("family.pin_invalid");
    const ok = await webPick(jar, { profileId: IDS.damien, pin: "2468" });
    expect(ok.json()).toMatchObject({ personal: true, token: tokens.damien });
    const back = applied(jar, ok);
    expect(back).toEqual({ tentacle_token: tokens.damien });
    expect((await whoAmI(back)).user?.userId).toBe(IDS.damien);
    // La session de Zoé est fermée.
    expect((await whoAmI({ tentacle_token: jar.tentacle_token })).profileEnded).toBe(true);
  });

  it("d'un profil à un autre : la réserve reste celle du compte", async () => {
    const { jar } = await inZoe();
    const res = await webPick(jar, { profileId: IDS.lea });
    expect(res.statusCode).toBe(200);
    const next = applied(jar, res);
    expect(next.tentacle_account_token).toBe(tokens.damien);
    expect((await whoAmI(next)).user?.userId).toBe(IDS.lea);
  });

  it("le bureau et le mobile ne reçoivent aucun cookie", async () => {
    const { zoe } = await seedFamily(app, tokens);
    const res = await send("POST", "/api/family/picker/sessions", tokens.damien, { platform: "desktop", profileId: zoe });
    expect(res.statusCode).toBe(200);
    expect(res.cookies).toHaveLength(0);
  });
});

describe("le web : une réserve ne vaut que derrière une session de profil", () => {
  it("face à une session personnelle (un autre compte connecté), elle est ignorée", async () => {
    await seedFamily(app, tokens);
    const res = await webProfiles({ tentacle_token: tokens.lea, tentacle_account_token: tokens.damien });
    expect(res.json().account.userId).toBe(IDS.lea);
  });

  it("sans session (déconnecté), elle n'ouvre rien", async () => {
    await seedFamily(app, tokens);
    expect((await webProfiles({ tentacle_account_token: tokens.damien })).statusCode).toBe(401);
  });

  it("la photo d'un invité : seulement pendant SA session", async () => {
    const { zoe, jar } = await inZoe();
    const photo = { image: Buffer.from("tentacle-avatar-".repeat(16)).toString("base64"), type: "image/jpeg" };
    expect((await browser("PUT", `/api/family/guests/${zoe}/photo`, jar, photo)).statusCode).toBe(200);
    const lea = applied(jar, await webPick(jar, { profileId: IDS.lea }));
    expect((await browser("PUT", `/api/family/guests/${zoe}/photo`, lea, photo)).statusCode).toBe(403);
  });
});

describe("le web : la déconnexion emporte la réserve", () => {
  it("en session de profil : réserve et session effacées, l'hôte et ses profils fermés", async () => {
    const { jar } = await inZoe();
    const res = await browser("POST", "/api/auth/logout", jar);
    expect(res.statusCode).toBe(200);
    expect(applied(jar, res)).toEqual({});
    expect((await whoAmI({ tentacle_token: jar.tentacle_token })).profileEnded).toBe(true);
    expect(h.state!.db.data.pairedDevice.filter((row) => row.platform === "web")).toHaveLength(0);
  });

  it("même si la session du profil a déjà pris fin, la réserve part", async () => {
    const { jar } = await inZoe();
    // Le compte reprend ailleurs (son bureau) : la session de profil du navigateur est fermée.
    expect((await send("POST", "/api/auth/logout", tokens.damien)).statusCode).toBe(200);
    const res = await browser("POST", "/api/auth/logout", jar);
    expect(applied(jar, res).tentacle_account_token).toBeUndefined();
  });
});
