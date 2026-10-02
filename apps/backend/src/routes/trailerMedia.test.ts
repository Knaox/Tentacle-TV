/**
 * Le relais des bandes-annonces de bout en bout, sans réseau : `/resolve` rend
 * un flux servi par CE serveur (jamais une URL googlevideo), le jeton de l'URL
 * ouvre le maître, les listes et les segments de SA vidéo seulement, et un
 * segment que googlevideo ne sert plus est relu après une nouvelle extraction.
 * yt-dlp et googlevideo sont factices ; l'auth est réduite à « un jeton ».
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string) => Promise<ExtractionResult>>() }));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource }));
vi.mock("../services/ytDlp", () => ({ startYtDlpUpdates: () => {} }));
// Le relais lit googlevideo par le `fetch` du paquet undici : renvoyé ici vers le global, que chaque test remplace.
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers.authorization !== "Bearer ok") return reply.status(401).send({ message: "Unauthorized" });
  },
}));

import { trailerRoutes } from "./trailers";
import { trailerMediaRoutes } from "./trailerMedia";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";

const ID = "Way9Dexny3w";
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const masterUrl = (gen: number) => `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/gen/${gen}/index.m3u8`;
const hls = (gen: number): ExtractionResult => ({
  ok: true,
  clients: ["visionos"],
  source: { kind: "hls", masterUrl: masterUrl(gen), headers: {}, expiresAt: FUTURE * 1000 },
});

/** googlevideo factice, génération `gen` : les URL d'une extraction précédente répondent 403. */
function googlevideo(gen: number) {
  const gv = `https://rr.googlevideo.test/gen/${gen}`;
  const pages: Record<string, string> = {
    [masterUrl(gen)]: `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720\n${gv}/itag/95/v.m3u8\n`,
    [`${gv}/itag/95/v.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\n${gv}/itag/95/sq/0.ts\n#EXT-X-ENDLIST\n`,
  };
  return vi.fn(async (url: string) => {
    if (url === `${gv}/itag/95/sq/0.ts`) return new Response(new Uint8Array([0x47, 1, 2, 3]), { headers: { "content-type": "video/mp2t" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

async function server() {
  const app = Fastify();
  await app.register(trailerRoutes, { prefix: "/api/trailers" });
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  return app;
}

beforeEach(() => {
  resetTrailerRelay();
  extractTrailerSource.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("/api/trailers/resolve", () => {
  it("exige un compte connecté et un identifiant YouTube valide", async () => {
    const app = await server();
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}` })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/trailers/resolve?ytId=../../etc", headers: { authorization: "Bearer ok" } })).statusCode).toBe(400);
  });

  it("rend un flux relayé par ce serveur, en chemin et en absolu", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const app = await server();
    const res = await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: { authorization: "Bearer ok", host: "tv.test:3000" } });
    const body = res.json();
    expect(body.mimeType).toBe("application/vnd.apple.mpegurl");
    expect(body.path).toMatch(new RegExp(`^/api/trailers/hls/${ID}/master\\.m3u8\\?t=[\\w.-]+$`));
    expect(body.url).toBe(`http://tv.test:3000${body.path}`);
    expect(JSON.stringify(body)).not.toContain("googlevideo");
  });

  it("dit « indisponible » sans flux, et prépare sans attendre", async () => {
    extractTrailerSource.mockResolvedValue({ ok: false, permanent: true, reason: "Private video" });
    const app = await server();
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: { authorization: "Bearer ok" } })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/trailers/prepare?ytId=${ID}`, headers: { authorization: "Bearer ok" } })).statusCode).toBe(202);
  });
});

describe("/api/trailers/report", () => {
  it("consigne l'issue d'une lecture, et refuse un compte rendu malformé", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await server();
    const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/trailers/report", headers: { authorization: "Bearer ok" }, payload: payload as object });
    expect((await post({ ytId: ID, ok: true, ms: 812 })).statusCode).toBe(204);
    expect(log).toHaveBeenCalledWith(`[trailers] ${ID} : première image en 812 ms`);
    expect((await post({ ytId: "nope", ok: true, ms: 1 })).statusCode).toBe(400);
    expect((await post({ ytId: ID, ok: false, ms: -5 })).statusCode).toBe(400);
    log.mockRestore();
  });
});

describe("flux relayés", () => {
  async function resolved(app: Awaited<ReturnType<typeof server>>) {
    const res = await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: { authorization: "Bearer ok" } });
    return res.json().path as string;
  }

  it("ne s'ouvrent qu'avec le jeton de leur vidéo", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const path = await resolved(app);
    const token = new URL(path, "http://x").searchParams.get("t");
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/master.m3u8` })).statusCode).toBe(403);
    expect((await app.inject({ url: `/api/trailers/hls/uYPbbksJxIg/master.m3u8?t=${token}` })).statusCode).toBe(403);
    expect((await app.inject({ url: path })).statusCode).toBe(200);
  });

  it("servent maître, liste et segment, le jeton recopié dans chaque URI", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const path = await resolved(app);
    const token = new URL(path, "http://x").searchParams.get("t");
    const master = await app.inject({ url: path });
    expect(master.headers["content-type"]).toContain("application/vnd.apple.mpegurl");
    expect(master.body).toContain(`p/95.m3u8?t=${token}`);
    const media = await app.inject({ url: `/api/trailers/hls/${ID}/p/95.m3u8?t=${token}` });
    expect(media.body).toContain(`../s/95/0.ts?t=${token}`);
    const segment = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}` });
    expect(segment.statusCode).toBe(200);
    expect(segment.headers["content-type"]).toBe("video/mp2t");
    expect([...segment.rawPayload]).toEqual([0x47, 1, 2, 3]);
  });

  it("relisent un segment refusé après une nouvelle extraction", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    extractTrailerSource.mockResolvedValueOnce(hls(1)).mockResolvedValueOnce(hls(2));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const path = await resolved(app);
    const token = new URL(path, "http://x").searchParams.get("t");
    await app.inject({ url: `/api/trailers/hls/${ID}/p/95.m3u8?t=${token}` });
    // Les URL de la première extraction meurent : googlevideo ne connaît plus que la seconde.
    vi.stubGlobal("fetch", googlevideo(2));
    vi.setSystemTime(Date.now() + 2 * 60_000);
    const segment = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}` });
    expect(segment.statusCode).toBe(200);
    expect(extractTrailerSource).toHaveBeenCalledTimes(2);
  });
});
