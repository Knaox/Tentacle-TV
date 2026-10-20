/**
 * Tests d'attaque — la session de profil du BUREAU devant le proxy Jellyfin
 * (SEC-F-50, SEC-F-49 versant proxy, SEC-F-34 étendu). Elle ne reçoit aucun
 * jeton Jellyfin : le proxy, qui lui prête la clé d'administration, est son
 * SEUL accès à Jellyfin — il la borne à SON compte (chemin ET query, toute
 * méthode) et aux écritures d'un appareil ; la clé ne lui revient jamais ;
 * coupée, elle ne passe plus.
 *
 * Un vrai serveur HTTP local joue Jellyfin pour le proxy (undici) ; le faux
 * Jellyfin des comptes reste sur le `fetch` global (Famille, Quick Connect).
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("../familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
  upstream: "",
  hits: [] as Array<{ method: string; url: string; token: string }>,
}));
vi.mock("../../src/services/configStore", async () => ({
  ...(await import("../familyMocks")).configStoreMock(() => h.state!),
  getJellyfinUrl: () => h.upstream,
}));
vi.mock("../../src/services/db", async () => (await import("../familyMocks")).dbMock(() => h.state!));
vi.mock("../../src/services/wsManager", async () => (await import("../familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../../src/services/pushService", async () => (await import("../familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../../src/services/deviceSessions/deviceAuth", async () => (await import("../familyMocks")).deviceAuthMock());
vi.mock("../../src/services/deviceSessions/gateway", async () => (await import("../familyMocks")).gatewayMock());

import { freshState } from "../familyMocks";
import { fakeJellyfinUsersFetch } from "../fakeJellyfinUsers";
import { IDS, resetCaches, seedUsers } from "../familyHarness";
import { buildPickerApp, pickSession, seedFamily, sender } from "../familyPickerHarness";
import { jellyfinProxyRoutes } from "../../src/routes/jellyfinProxy";
import { clearAll } from "../../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

const ITEM = "a1".repeat(16);

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    const token = /Token="([^"]*)"/.exec(String(req.headers.authorization))?.[1] ?? "";
    h.hits.push({ method: String(req.method), url: String(req.url), token });
    if (req.method === "DELETE" || /Sessions\/Playing/.test(String(req.url))) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    // Jellyfin recopie la clé qu'on lui présente dans les URL qu'il fabrique.
    res.end(JSON.stringify({ MediaSources: [{ TranscodingUrl: `/videos/${ITEM}/master.m3u8?ApiKey=${token}` }] }));
  });
  await new Promise<void>((resolve) => jellyfin.listen(0, "127.0.0.1", resolve));
  h.upstream = `http://127.0.0.1:${(jellyfin.address() as AddressInfo).port}`;
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => h.fetch!(input, init));
  app = await buildPickerApp(async (instance) => {
    await instance.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
  });
});
afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve) => jellyfin.close(() => resolve()));
  vi.unstubAllGlobals();
});
beforeEach(() => {
  h.state = freshState();
  h.fetch = fakeJellyfinUsersFetch(h.state.jf);
  h.hits = [];
  resetCaches();
  clearAll();
  tokens = seedUsers(h.state);
});

/** Comme les lecteurs : le jeton dans l'en-tête `MediaBrowser`. */
function proxy(method: string, path: string, token: string, body?: object) {
  return app.inject({
    method: method as "GET",
    url: `/api/jellyfin/${path}`,
    headers: {
      authorization: `MediaBrowser Client="Tentacle TV - Desktop", Device="Desktop", DeviceId="x", Version="1", Token="${token}"`,
      ...(body && { "content-type": "application/json" }),
    },
    ...(body && { payload: body }),
  });
}

async function guestOnDesktop(): Promise<{ zoe: string; token: string }> {
  const { zoe } = await seedFamily(app, tokens);
  return { zoe, token: await pickSession(app, tokens.damien, zoe) };
}

describe("SEC-F-50 : la session de profil du bureau ne parle que pour SON compte", () => {
  it("lit SES données (clé prêtée en aval), jamais celles d'un autre compte — chemin, query, casse", async () => {
    const { zoe, token } = await guestOnDesktop();
    expect((await proxy("GET", `Users/${zoe}/Items?ParentId=${ITEM}`, token)).statusCode).toBe(200);
    expect(h.hits.at(-1)).toMatchObject({ method: "GET", token: "cle-admin" });
    expect(h.hits.at(-1)?.url).toContain(`userId=${zoe}`);
    const before = h.hits.length;
    for (const path of [
      `Users/${IDS.damien}/Items`,
      `Items?userId=${IDS.damien}`,
      `Shows/NextUp?UserId=${IDS.damien.toUpperCase()}`,
      `Users/${IDS.lea}/Views`,
      `Items/${ITEM}/PlaybackInfo?userId=${IDS.damien}`,
    ]) {
      expect((await proxy("GET", path, token)).statusCode, path).toBe(403);
    }
    expect(h.hits.length).toBe(before);
  });

  it("lit la photo des AUTRES membres (sa séance de Watch Together la montre), sans jamais la poser", async () => {
    const { token } = await guestOnDesktop();
    expect((await proxy("GET", `Users/${IDS.damien}/Images/Primary?tag=t&maxWidth=96`, token)).statusCode).toBe(200);
    // Relayée sous sa forme moderne (`/UserImage?userId=`, cf. modernRoutes).
    expect(h.hits.at(-1)?.url).toMatch(new RegExp(`^/UserImage\\?.*userId=${IDS.damien}`));
    const before = h.hits.length;
    expect((await proxy("POST", `Users/${IDS.damien}/Images/Primary`, token, {})).statusCode).toBe(403);
    expect(h.hits.length).toBe(before);
  });

  it("une requête SANS utilisateur ne lit jamais pour la clé prêtée : elle est bornée à SON compte", async () => {
    const { zoe, token } = await guestOnDesktop();
    for (const path of ["Items?Recursive=true&IncludeItemTypes=Movie", `Items/${ITEM}`, "Shows/NextUp?Limit=5", "Search/Hints?searchTerm=a"]) {
      expect((await proxy("GET", path, token)).statusCode, path).toBe(200);
      const sent = new URL(`http://jf${h.hits.at(-1)!.url}`);
      expect(sent.searchParams.get("userId"), path).toBe(zoe);
    }
    // Un flux ou une image ne nomment aucun compte : rien n'y est ajouté.
    await proxy("GET", `Items/${ITEM}/Images/Primary`, token);
    expect(h.hits.at(-1)!.url).not.toContain("userId");
  });

  it("n'écrit que ce qu'écrit un appareil, et pour lui seul : jamais un titre, jamais chez un autre", async () => {
    const { zoe, token } = await guestOnDesktop();
    expect((await proxy("POST", `Users/${zoe}/FavoriteItems/${ITEM}`, token)).statusCode).toBe(200);
    const before = h.hits.length;
    const refused: Array<[string, string, object?]> = [
      ["DELETE", `Items/${ITEM}`],
      ["POST", `Items/${ITEM}`, { Name: "renommé" }],
      ["POST", `Items/${ITEM}/Images/Primary`, {}],
      ["POST", `Users/${IDS.damien}/FavoriteItems/${ITEM}`],
      ["DELETE", `Users/${IDS.damien}/PlayedItems/${ITEM}`],
      ["POST", `UserItems/${ITEM}/UserData?userId=${IDS.damien}`, { Played: true }],
    ];
    for (const [method, path, body] of refused) {
      expect((await proxy(method, path, token, body)).statusCode, `${method} ${path}`).toBe(403);
    }
    expect(h.hits.length).toBe(before);
  });

  it("la clé d'administration ne lui revient jamais, et les reports partent sous le jeton PROPRE de la session", async () => {
    const { zoe, token } = await guestOnDesktop();
    const info = await proxy("POST", `Items/${ITEM}/PlaybackInfo?userId=${zoe}`, token, { DeviceProfile: {} });
    expect(info.statusCode).toBe(200);
    expect(info.body).not.toContain("cle-admin");
    expect(info.body).toContain(`ApiKey=${encodeURIComponent(token)}`);
    expect((await proxy("POST", "Sessions/Playing", token, { ItemId: ITEM, PositionTicks: 10 })).statusCode).toBe(204);
    const report = h.hits.at(-1)!;
    // Jellyfin attribue au porteur : le jeton frappé pour CETTE session, côté serveur seulement.
    expect(report.token).not.toBe("cle-admin");
    expect(report.token).not.toBe(token);
    expect([...h.state!.jf.devices.values()].find((d) => d.token === report.token)?.userId).toBe(zoe);
  });
});

describe("SEC-F-49 : coupée, la session ne passe plus le proxy", () => {
  it("après la déconnexion du compte sur ce bureau : 401 profileEnded, rien n'atteint Jellyfin", async () => {
    const { zoe, token } = await guestOnDesktop();
    expect((await sender(app)("POST", "/api/auth/logout", tokens.damien)).statusCode).toBe(200);
    const before = h.hits.length;
    const res = await proxy("GET", `Users/${zoe}/Items`, token);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ revoked: true, profileEnded: true });
    expect(h.hits.length).toBe(before);
  });
});
