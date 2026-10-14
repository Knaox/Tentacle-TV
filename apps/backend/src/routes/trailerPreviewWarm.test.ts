/**
 * `POST /api/trailers/preview/warm` de bout en bout, sans réseau : les titres
 * à l'écran se préparent EN FOND — la bande-annonce AlloCiné (Dailymotion,
 * factice dans la forme relevée le 2026-10-14) est résolue, une vidéo YouTube
 * que le relais tient est préparée, une vidéo YouTube à extraire attend le
 * survol (jamais d'extraction en fond) — et le survol trouve la décision
 * prise. Un titre de la bibliothèque n'est rendu qu'à un compte qui le voit.
 * Le catalogue et yt-dlp sont factices ; l'auth est réduite à « un jeton ».
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";
import type { TrailerCatalogResponse, TrailerEntry } from "../trailers/trailerCatalog";

const { extractTrailerSource, catalogs, detailed } = vi.hoisted(() => ({
  extractTrailerSource: vi.fn<(ytId: string, options?: unknown) => Promise<ExtractionResult>>(),
  catalogs: new Map<string, TrailerCatalogResponse>(),
  detailed: vi.fn(),
}));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource, prewarmExtraction: () => undefined }));
const catalogOf = (request: Record<string, unknown>): TrailerCatalogResponse =>
  catalogs.get(String(request.itemId ?? `${request.mediaType}:${request.tmdbId}`)) ?? { entries: [], complete: true, language: "fr" };
vi.mock("../services/trailers/catalog/catalogBuild", () => ({
  buildCatalog: async (request: Record<string, unknown>) => catalogOf(request),
  buildCatalogDetailed: async (...args: unknown[]) => detailed(...args),
}));
vi.mock("../services/trailers/catalog/catalogTitle", () => ({
  resolveCatalogTitle: async (itemId: string, userId: string) =>
    (itemId === MOVIE && !userId.startsWith("intrus") ? { kind: "title", title: {} } : { kind: "none" }),
}));
vi.mock("../services/configStore", () => ({ getPublicUrl: () => null, getConfigValue: () => undefined }));
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown>; user?: unknown }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    const token = String(request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: token.padEnd(32, "0").slice(0, 32), username: token, isAdmin: false, session: "personal" };
  },
}));

import { setTitleLanguage } from "../services/reco/titleLanguage";
import { resetDailymotionGuard } from "../services/trailers/dailymotionGuard";
import { resetPreviewDecisions } from "../services/trailers/preview/previewDecision";
import { previewWarmState, resetPreviewWarm } from "../services/trailers/preview/previewWarm";
import { resetTrailerRelay, resolveTrailer } from "../services/trailers/trailerRelay";
import { resetYouTubeGuard } from "../services/trailers/youtubeGuard";
import { trailerPreviewRoutes } from "./trailerPreview";
import { resetPreviewWarmLimiter, trailerPreviewWarmRoutes } from "./trailerPreviewWarm";

const MOVIE = "0123456789abcdef0123456789abcdef";
const DM = "x8e90ff";
const YT = "Way9Dexny3w";
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const YT_MASTER = `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/index.m3u8`;
const DM_MASTER = `https://cdndirector.dailymotion.com/cdn/manifest/video/${DM}.m3u8?sec=abc`;
const CDN = "https://vod2.cf.dmcdn.net/sec2(tok)/cloud/194/466";
const GV = "https://rr.googlevideo.test";

/** Dailymotion (métadonnées, maître, liste) et googlevideo (maître, listes), factices. */
function upstream() {
  const pages: Record<string, string> = {
    [`https://www.dailymotion.com/player/metadata/video/${DM}`]: JSON.stringify({ id: DM, qualities: { auto: [{ type: "application/x-mpegURL", url: DM_MASTER }] } }),
    [DM_MASTER]: `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x720\n${CDN}/hd.m3u8\n`,
    [`${CDN}/hd.m3u8`]: "#EXTM3U\n#EXTINF:3.000000,\n../../../frag(1)/cloud/194/466/hd.ts\n#EXT-X-ENDLIST\n",
    [YT_MASTER]: `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720\n${GV}/itag/232/v.m3u8\n`,
    [`${GV}/itag/232/v.m3u8`]: `#EXTM3U\n#EXTINF:5,\n${GV}/seg/232/0.ts\n#EXT-X-ENDLIST\n`,
  };
  return vi.fn(async (input: string) => {
    const url = String(input).replace(/#.*$/, "");
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

const entry = (playback: TrailerEntry["playback"], source: TrailerEntry["source"] = "tmdb"): TrailerEntry =>
  ({ scope: { kind: "movie" }, playback, name: "Bande-annonce VF", version: "localized", type: "trailer", source });
const dailymotionFirst = (): TrailerCatalogResponse => ({
  entries: [entry({ kind: "dailymotion", videoId: DM }, "allocine"), entry({ kind: "youtube", ytId: YT })], complete: true, language: "fr",
});
const youtubeOnly = (): TrailerCatalogResponse => ({ entries: [entry({ kind: "youtube", ytId: YT })], complete: true, language: "fr" });

async function server() {
  const app = Fastify();
  await app.register(trailerPreviewRoutes, { prefix: "/api/trailers" });
  await app.register(trailerPreviewWarmRoutes, { prefix: "/api/trailers" });
  return app;
}

const warm = (app: Awaited<ReturnType<typeof server>>, subjects: unknown[], token = "alice") =>
  app.inject({ method: "POST", url: "/api/trailers/preview/warm", headers: { authorization: `Bearer ${token}` }, payload: { subjects, lang: "fr", dailymotion: true } });

/** La préparation est en fond : on attend qu'elle ait tout fini. */
const settled = () => vi.waitFor(() => expect(previewWarmState()).toEqual({ running: 0, queued: 0 }));

beforeEach(() => {
  resetTrailerRelay();
  resetYouTubeGuard();
  resetDailymotionGuard();
  resetPreviewDecisions();
  resetPreviewWarm();
  resetPreviewWarmLimiter();
  setTitleLanguage("fr-FR");
  catalogs.clear();
  detailed.mockReset().mockImplementation(async (request: Record<string, unknown>) => ({ response: catalogOf(request), answered: true }));
  extractTrailerSource.mockReset().mockResolvedValue({
    ok: true, clients: ["visionos"], subtitles: [],
    source: { kind: "hls", masterUrl: YT_MASTER, headers: {}, expiresAt: FUTURE * 1000, heights: [720] },
  });
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", upstream());
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("POST /api/trailers/preview/warm", () => {
  it("prépare en fond la bande-annonce AlloCiné ; la demande suivante la rend prête, le survol aussi", async () => {
    catalogs.set("movie:603", dailymotionFirst());
    const app = await server();
    const first = await warm(app, [{ tmdbId: 603, mediaType: "movie" }]);
    expect([first.statusCode, first.json()]).toEqual([200, { ready: [], queued: 1 }]);
    expect(first.headers["cache-control"]).toBe("private, no-store");
    await settled();
    const again = (await warm(app, [{ tmdbId: 603, mediaType: "movie" }])).json();
    expect(again.queued).toBe(0);
    expect(again.ready).toEqual([{ subject: { tmdbId: 603, mediaType: "movie" }, preview: expect.objectContaining({ ytId: "", source: { kind: "dailymotion", videoId: DM } }) }]);
    // Le catalogue a été demandé EN FOND, et jamais YouTube.
    expect(detailed).toHaveBeenCalledWith({ tmdbId: 603, mediaType: "movie", lang: "fr" }, expect.any(String), expect.any(Number), { priority: "background" });
    expect(extractTrailerSource).not.toHaveBeenCalled();
    // Le survol trouve la décision prise : aucune décision de plus.
    const hover = await app.inject({ url: `/api/trailers/preview?tmdbId=603&mediaType=movie&lang=fr&dm=1`, headers: { authorization: "Bearer alice" } });
    expect(hover.json().source).toEqual({ kind: "dailymotion", videoId: DM });
    expect(detailed).toHaveBeenCalledTimes(1);
  });

  it("jamais d'extraction YouTube en fond : la première vidéo à extraire attend le survol", async () => {
    catalogs.set("movie:604", youtubeOnly());
    const app = await server();
    expect((await warm(app, [{ tmdbId: 604, mediaType: "movie" }])).json().queued).toBe(1);
    await settled();
    expect(extractTrailerSource).not.toHaveBeenCalled();
    // Différé : la demande suivante ne la remet pas en préparation (repos de dix minutes).
    expect((await warm(app, [{ tmdbId: 604, mediaType: "movie" }])).json()).toEqual({ ready: [], queued: 0 });
  });

  it("une vidéo YouTube que le relais tient déjà se prépare, sans extraction", async () => {
    catalogs.set("movie:605", youtubeOnly());
    await resolveTrailer(YT);
    extractTrailerSource.mockClear();
    const app = await server();
    await warm(app, [{ tmdbId: 605, mediaType: "movie" }]);
    await settled();
    const ready = (await warm(app, [{ tmdbId: 605, mediaType: "movie" }])).json().ready;
    expect(ready.map((r: { preview: { ytId: string } }) => r.preview.ytId)).toEqual([YT]);
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("un catalogue dont une source n'a pas répondu ne décide rien", async () => {
    catalogs.set("movie:606", dailymotionFirst());
    detailed.mockImplementation(async (request: Record<string, unknown>) => ({ response: catalogOf(request), answered: false }));
    const app = await server();
    await warm(app, [{ tmdbId: 606, mediaType: "movie" }]);
    await settled();
    expect((await warm(app, [{ tmdbId: 606, mediaType: "movie" }])).json()).toEqual({ ready: [], queued: 0 });
    // Le survol, lui, décide (la même bande-annonce AlloCiné).
    const hover = await app.inject({ url: `/api/trailers/preview?tmdbId=606&mediaType=movie&lang=fr&dm=1`, headers: { authorization: "Bearer alice" } });
    expect(hover.json().source).toEqual({ kind: "dailymotion", videoId: DM });
  });

  it("un titre de la bibliothèque : préparé pour qui le voit, jamais rendu à qui ne le voit pas", async () => {
    catalogs.set(MOVIE, dailymotionFirst());
    const app = await server();
    // Un compte qui ne le voit pas ne le fait pas décider pour les autres.
    await warm(app, [{ itemId: MOVIE }], "intrus");
    await settled();
    expect(detailed).not.toHaveBeenCalled();
    await warm(app, [{ itemId: MOVIE }], "alice");
    await settled();
    expect((await warm(app, [{ itemId: MOVIE }], "alice")).json().ready).toHaveLength(1);
    expect((await warm(app, [{ itemId: MOVIE }], "intrus")).json()).toEqual({ ready: [], queued: 0 });
  });

  it("refuse un corps illisible (400) et le trop de demandes d'un compte (429, Retry-After)", async () => {
    const app = await server();
    const bad = await app.inject({ method: "POST", url: "/api/trailers/preview/warm", headers: { authorization: "Bearer alice" }, payload: { subjects: [{ itemId: "x" }] } });
    expect([bad.statusCode, bad.json()]).toEqual([400, { error: "invalid_request" }]);
    for (let i = 0; i < 10; i++) expect((await warm(app, [{ tmdbId: 700 + i, mediaType: "movie" }])).statusCode).toBe(200);
    const limited = await warm(app, [{ tmdbId: 799, mediaType: "movie" }]);
    expect([limited.statusCode, limited.json(), limited.headers["retry-after"]]).toEqual([429, { error: "rate_limited", retryAfterS: 2 }, "2"]);
    await settled();
  });
});
