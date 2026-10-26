/**
 * « Accès à Octave » et « Lecture des médias » tenus par le SERVEUR : un appel
 * DIRECT aux routes musique du cœur, par un compte sans le droit, est refusé —
 * l'interface n'y est pour rien. Les vraies routes (`musicRoutes`), la vraie
 * garde d'authentification (Jellyfin bouchonné par le `fetch` global).
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { musicRoutes } from "./musicRoutes";

const TOKEN = "jeton-du-banc-0123456789";
const ITEM = "c".repeat(32);
const ROW = { id: ITEM, kind: "track", imageTag: null };

const state = vi.hoisted(() => ({ octave: true, playback: true as boolean | null }));

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle",
  getConfigValue: () => undefined,
}));
vi.mock("../../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../musicService", () => ({ ensureMusicIndex: () => undefined }));
vi.mock("./requestView", () => ({
  userOf: () => ({ userId: "u1" }),
  viewOf: async () => ({ userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set() }),
}));
vi.mock("../view/libraryViews", () => ({
  statusView: async () => ({ available: true, libraryId: "lib", indexReady: true, trackCount: 3 }),
  albumsPageView: async () => ({ items: [], nextCursor: null }),
  albumView: async () => null,
  artistsPageView: async () => ({ items: [], nextCursor: null }),
  artistView: async () => null,
  searchView: async () => ({ query: "", tracks: [], albums: [], artists: [], playlists: [], tookMs: 0 }),
}));
vi.mock("../index/indexSync", () => ({ syncState: () => ({ ready: true }) }));
vi.mock("../index/indexQueries", () => ({ rowById: async () => ROW }));
vi.mock("../media/playbackSource", () => ({
  playableRow: async () => ROW,
  sourceFor: async () => ({ url: `/api/music/stream/${ITEM}` }),
}));
vi.mock("../media/streamRelay", () => ({
  AUDIO_BYTES: { compress: false },
  relayStream: async (_request: unknown, reply: { type: (t: string) => { send: (b: string) => unknown } }) => reply.type("audio/flac").send("octets"),
}));
vi.mock("../../services/octaveRights/octaveAccess", () => ({ hasOctaveAccess: async () => state.octave }));
vi.mock("../../services/playbackRights", () => ({
  getAccountPlaybackPolicy: async () => (state.playback === null ? null : { enableMediaPlayback: state.playback }),
}));

beforeEach(() => {
  state.octave = true;
  state.playback = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      if (String(input).includes("/Users/Me")) {
        return auth.includes(TOKEN)
          ? new Response(JSON.stringify({ Id: "u1", Name: "octave1", Policy: { IsAdministrator: false } }), { status: 200 })
          : new Response("", { status: 401 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeApp() {
  const app = Fastify();
  await app.register(musicRoutes, { prefix: "/api/music" });
  return app;
}

const auth = { authorization: `Bearer ${TOKEN}` };

describe("« Accès à Octave » sur les routes musique", () => {
  it("permis (le défaut) : tout répond comme avant", async () => {
    const app = await makeApp();
    const status = await app.inject({ method: "GET", url: "/api/music/status", headers: auth });
    expect(status.json()).toEqual({ available: true, libraryId: "lib", indexReady: true, trackCount: 3 });
    expect((await app.inject({ method: "GET", url: "/api/music/albums", headers: auth })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/music/stream/${ITEM}`, headers: auth })).body).toBe("octets");
    await app.close();
  });

  it("coupé : le statut dit « indisponible », sans erreur ni existence trahie", async () => {
    state.octave = false;
    const app = await makeApp();
    const status = await app.inject({ method: "GET", url: "/api/music/status", headers: auth });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ available: false, libraryId: null, indexReady: true, trackCount: 0, octaveAccess: false });
    await app.close();
  });

  it("coupé : un appel direct à toute autre route est refusé (403 octave_access_denied)", async () => {
    state.octave = false;
    const app = await makeApp();
    const calls: { method: "GET" | "POST" | "PUT"; url: string }[] = [
      { method: "GET", url: "/api/music/albums" },
      { method: "GET", url: "/api/music/search?q=a" },
      { method: "GET", url: "/api/music/home" },
      { method: "GET", url: `/api/music/source/${ITEM}` },
      { method: "GET", url: `/api/music/stream/${ITEM}` },
      { method: "GET", url: "/api/music/liked" },
      { method: "PUT", url: `/api/music/favorite/${ITEM}` },
      { method: "POST", url: "/api/music/playlists" },
    ];
    for (const call of calls) {
      const response = await app.inject({ ...call, headers: auth, payload: call.method === "GET" ? undefined : {} });
      expect(response.statusCode, call.url).toBe(403);
      expect(response.json(), call.url).toEqual({ error: "octave_access_denied" });
    }
    await app.close();
  });

  it("sans session : 401 d'abord, la porte d'Octave ne parle pas", async () => {
    state.octave = false;
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/music/status" })).statusCode).toBe(401);
    await app.close();
  });
});

describe("serveur sous la version de `music.library`", () => {
  it("1.31.4 : chaque route musique répond 404 not_available, avant toute garde", async () => {
    serverVersion.value = "1.31.4";
    const { resetDeclaredCapabilitiesForTests } = await import("../../serverCapabilities/declaredCapabilities");
    resetDeclaredCapabilitiesForTests();
    const app = await makeApp();
    for (const url of ["/api/music/status", "/api/music/albums", `/api/music/stream/${ITEM}`]) {
      for (const headers of [auth, {}]) {
        const response = await app.inject({ method: "GET", url, headers });
        expect(response.statusCode, url).toBe(404);
        expect(response.json()).toEqual({ error: "not_available" });
      }
    }
    await app.close();
    serverVersion.value = "1.40.0";
    resetDeclaredCapabilitiesForTests();
  });
});

describe("« Lecture des médias » (Jellyfin) sur la musique", () => {
  it("coupée : ni source ni flux (403 playback_not_allowed) ; parcourir reste permis", async () => {
    state.playback = false;
    const app = await makeApp();
    for (const url of [`/api/music/source/${ITEM}`, `/api/music/stream/${ITEM}`]) {
      const response = await app.inject({ method: "GET", url, headers: auth });
      expect(response.statusCode, url).toBe(403);
      expect(response.json()).toEqual({ code: "playback_not_allowed", error: "Forbidden" });
    }
    expect((await app.inject({ method: "GET", url: "/api/music/albums", headers: auth })).statusCode).toBe(200);
    await app.close();
  });

  it("politique illisible : rien n'est refusé d'office (Jellyfin décide, comme pour la vidéo)", async () => {
    state.playback = null;
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: `/api/music/stream/${ITEM}`, headers: auth })).statusCode).toBe(200);
    await app.close();
  });
});
