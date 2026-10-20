/**
 * Le proxy Jellyfin et le cookie de CONNEXION que garde le téléphone (alpha
 * mobile 1.20.0, 20/10). AVPlayer (iOS) lit le flux d'un profil sans en-tête,
 * avec `api_key=<jeton du profil>` ; le pot de React Native y joint le cookie
 * `tentacle_token` que `/api/auth/login` a posé : le jeton Jellyfin du COMPTE.
 * Le proxy le préférait : le flux partait au nom du compte, avec ses droits —
 * le contrôle parental d'un enfant contourné. Désormais le jeton explicite
 * l'emporte sur un cookie de connexion (cf. sessionTokenChoice) ; la page web,
 * sa session de profil (compte en réserve) et le moteur hors ligne, qui
 * présente exprès le jeton du compte, ne changent pas.
 *
 * Vrai harnais de la Famille (session de profil frappée par le serveur,
 * plateforme mobile), vrai proxy ; un serveur HTTP local joue Jellyfin.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: null as null | import("./familyMocks").HarnessState,
  fetch: null as null | ((input: string | URL, init?: RequestInit) => Promise<Response>),
  upstream: "",
  hits: [] as Array<{ url: string; token: string }>,
}));
vi.mock("../src/services/configStore", async () => ({
  ...(await import("./familyMocks")).configStoreMock(() => h.state!),
  getJellyfinUrl: () => h.upstream,
}));
vi.mock("../src/services/db", async () => (await import("./familyMocks")).dbMock(() => h.state!));
vi.mock("../src/services/wsManager", async () => (await import("./familyMocks")).wsManagerMock(() => h.state!));
vi.mock("../src/services/pushService", async () => (await import("./familyMocks")).pushServiceMock(() => h.state!));
vi.mock("../src/services/deviceSessions/deviceAuth", async () => (await import("./familyMocks")).deviceAuthMock());
vi.mock("../src/services/deviceSessions/gateway", async () => (await import("./familyMocks")).gatewayMock());

import { freshState } from "./familyMocks";
import { fakeJellyfinUsersFetch } from "./fakeJellyfinUsers";
import { resetCaches, seedUsers } from "./familyHarness";
import { buildPickerApp, pick, seedFamily } from "./familyPickerHarness";
import { jellyfinProxyRoutes } from "../src/routes/jellyfinProxy";
import { clearAll } from "../src/services/jellyfinCache";

let jellyfin: http.Server;
let app: FastifyInstance;
let tokens: ReturnType<typeof seedUsers>;

const CATALOG = "Items?Recursive=true&IncludeItemTypes=Movie";

beforeAll(async () => {
  jellyfin = http.createServer((req, res) => {
    const token = /Token="([^"]*)"/.exec(String(req.headers.authorization))?.[1] ?? "";
    h.hits.push({ url: String(req.url), token });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ Items: [], TotalRecordCount: 0 }));
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

/** Le téléphone de Damien ouvre le profil de Zoé (invitée) par « Qui regarde ? ». */
async function zoeOnPhone(): Promise<{ zoe: string; profileToken: string }> {
  const { zoe } = await seedFamily(app, tokens);
  const picked = await pick(app, tokens.damien, { profileId: zoe, platform: "mobile" });
  if (picked.statusCode !== 200 || picked.json().personal !== false) throw new Error(`profil refusé : ${picked.body}`);
  return { zoe, profileToken: picked.json().token as string };
}

/** Une requête SANS en-tête (AVPlayer, `<img>`) : le cookie qu'on lui donne, le jeton en query. */
function bare(path: string, cookie: string | null, apiKey?: string) {
  const query = apiKey ? `${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}` : "";
  return app.inject({ method: "GET", url: `/api/jellyfin/${path}${query}`, ...(cookie && { cookies: { tentacle_token: cookie } }) });
}

const lastSent = () => new URL(`http://jf${h.hits.at(-1)!.url}`);

describe("le proxy face au cookie de connexion du téléphone", () => {
  it("AVPlayer en session de profil : bornée au profil, clé prêtée — jamais le jeton du compte", async () => {
    const { zoe, profileToken } = await zoeOnPhone();
    expect((await bare(CATALOG, tokens.damien, profileToken)).statusCode).toBe(200);
    expect(h.hits.at(-1)!.token).toBe("cle-admin");
    expect(lastSent().searchParams.get("userId")).toBe(zoe);
  });

  it("la page web sans profil : son cookie seul, relayé tel quel", async () => {
    expect((await bare(CATALOG, tokens.damien)).statusCode).toBe(200);
    expect(h.hits.at(-1)!.token).toBe(tokens.damien);
    expect(lastSent().searchParams.get("userId")).toBeNull();
  });

  it("la page web en session de profil (cookie JWT, compte en réserve) : le profil, même devant un `api_key` du compte", async () => {
    const { zoe, profileToken } = await zoeOnPhone();
    expect((await bare(CATALOG, profileToken, tokens.damien)).statusCode).toBe(200);
    expect(h.hits.at(-1)!.token).toBe("cle-admin");
    expect(lastSent().searchParams.get("userId")).toBe(zoe);
  });

  it("le moteur hors ligne, qui présente EXPRÈS le jeton du compte pendant un profil : relayé au nom du compte", async () => {
    await zoeOnPhone();
    expect((await bare(CATALOG, tokens.damien, tokens.damien)).statusCode).toBe(200);
    expect(h.hits.at(-1)!.token).toBe(tokens.damien);
  });
});
