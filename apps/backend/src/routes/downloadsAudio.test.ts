/**
 * L'Allégé AUDIO de `/api/downloads/light` (musique gardée) : la requête
 * envoyée à Jellyfin, sa garde (mode Allégé + conversion du son), et la vidéo
 * qui ne change pas.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rights = vi.hoisted(() => ({ audio: true }));

// Un serveur 1.40.0 : les fonctions d'Octave et des extensions isolées y sont déclarées (declaredCapabilities.ts).
const serverVersion = vi.hoisted(() => ({ value: "1.40.0" }));
vi.mock("../services/version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { user?: unknown }) => {
    request.user = { userId: "u1", username: "banc", isAdmin: false };
  },
  getTokenFromRequest: () => "jeton",
}));
vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jellyfin.test" }));
vi.mock("../services/jellyfinPolicy", () => ({
  checkDownloadRight: async () => true,
  checkLightRight: async () => true,
  checkRemuxRight: async () => true,
  checkAudioLightRight: async () => rights.audio,
  getDownloadCapabilities: async () => ({}),
  mediaBrowserAuthHeader: () => "MediaBrowser Token=jeton",
}));
vi.mock("../services/downloadBandwidth/throttledStream", () => ({ throttled: (_request: unknown, stream: unknown) => stream }));

import { downloadRoutes } from "./downloads";

const ITEM = "0123456789abcdef0123456789abcdef";
let asked: string[] = [];

beforeEach(() => {
  asked = [];
  rights.audio = true;
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(url);
    return new Response("son", { status: 200, headers: { "content-type": "audio/mp4" } });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function get(url: string) {
  const app = Fastify();
  await app.register(downloadRoutes);
  const res = await app.inject({ method: "GET", url });
  await app.close();
  return res;
}

describe("Allégé audio", () => {
  it("demande à Jellyfin un AAC 256 kb/s en MP4 fragmenté, et rend la session à arrêter", async () => {
    const res = await get(`/light/${ITEM}?mediaSourceId=${ITEM}&preset=a256`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("son");
    expect(res.headers["content-type"]).toBe("audio/mp4");
    expect(res.headers["x-tentacle-play-session"]).toBeTruthy();
    const url = new URL(asked[0]!);
    expect(url.pathname).toBe(`/Audio/${ITEM}/stream.m4a`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ static: "false", container: "m4a", audioCodec: "aac", audioBitRate: "256000" });
  });

  it("sans le mode Allégé ou la conversion du son : 404, rien demandé à Jellyfin", async () => {
    rights.audio = false;
    expect((await get(`/light/${ITEM}?preset=a256`)).statusCode).toBe(404);
    expect(asked).toEqual([]);
  });

  it("serveur 1.31.4 (sans `offline.music`) : 404, rien demandé à Jellyfin", async () => {
    serverVersion.value = "1.31.4";
    const { resetDeclaredCapabilitiesForTests } = await import("../serverCapabilities/declaredCapabilities");
    resetDeclaredCapabilitiesForTests();
    expect((await get(`/light/${ITEM}?mediaSourceId=${ITEM}&preset=a256`)).statusCode).toBe(404);
    expect(asked).toEqual([]);
    serverVersion.value = "1.40.0";
    resetDeclaredCapabilitiesForTests();
  });

  it("un palier vidéo reste la vidéo", async () => {
    await get(`/light/${ITEM}?preset=p720`);
    expect(new URL(asked[0]!).pathname).toBe(`/Videos/${ITEM}/stream.mp4`);
  });
});
