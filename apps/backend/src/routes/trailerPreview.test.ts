/**
 * `GET /api/trailers/preview` de bout en bout, sans réseau : un compte
 * connecté (une session de profil aussi), une demande lisible, un titre que
 * ce compte voit ; la réponse est un flux RELAYÉ que le jeton ouvre, lisible
 * depuis l'origine du bureau (`tentacle://app`). Le catalogue, yt-dlp et
 * googlevideo sont factices ; l'auth est réduite à « un jeton ».
 */

import { readFileSync } from "fs";
import { join } from "path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";
import type { TrailerCatalogResponse } from "../trailers/trailerCatalog";

const { extractTrailerSource, buildCatalog, tmdbCatalog, jellyfinAdminFetch } = vi.hoisted(() => ({
  extractTrailerSource: vi.fn<(ytId: string, options?: unknown) => Promise<ExtractionResult>>(),
  buildCatalog: vi.fn<(request: Record<string, unknown>, account: string) => Promise<TrailerCatalogResponse>>(),
  tmdbCatalog: vi.fn<(tmdbId: number) => TrailerCatalogResponse>(),
  jellyfinAdminFetch: vi.fn(),
}));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource, prewarmExtraction: () => undefined }));
vi.mock("../services/trailers/catalog/catalogBuild", () => ({ buildCatalog }));
// Ce que chaque compte voit : le film pour tous sauf « intrus » ; une collection n'a rien ; Jellyfin muet : « error ».
vi.mock("../services/trailers/catalog/catalogTitle", () => ({
  resolveCatalogTitle: async (itemId: string, userId: string) => {
    if (userId.startsWith("muet")) return { kind: "error" };
    return itemId === "0123456789abcdef0123456789abcdef" && !userId.startsWith("intrus") ? { kind: "title", title: {} } : { kind: "none" };
  },
}));
vi.mock("../services/jellyfinAdminFetch", () => ({ jellyfinAdminFetch }));
vi.mock("../services/configStore", () => ({ getPublicUrl: () => null, getConfigValue: () => undefined }));
// Le périmètre réel des sessions de profil, pour un INVITÉ de la Famille.
vi.mock("../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => true }));
vi.mock("../services/family/familyGuestExtensions", () => ({ EXTENSIONS_PREFIX: "/api/plugins", guestExtensionAccess: async () => "denied" }));
// Le relais lit googlevideo par le `fetch` du paquet undici : renvoyé ici vers le global, que chaque test remplace.
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown>; user?: unknown }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    const token = String(request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) return reply.status(401).send({ message: "Unauthorized" });
    // `profil-…` : une session de profil d'une TV (un invité de la Famille, par exemple).
    request.user = { userId: token.padEnd(32, "0").slice(0, 32), username: token, isAdmin: false, session: token.startsWith("profil") ? "tvProfile" : "personal" };
  },
}));

import { profileSessionScope } from "../services/family/profileSessionLimits";
import { parseCorsOrigins, tentacleCorsDelegator } from "../services/tentacleCors";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";
import { resetHeldSegments } from "../services/trailers/trailerSegments";
import { countPreviewExtraction, resetYouTubeGuard, tripYouTubeBreaker } from "../services/trailers/youtubeGuard";
import { resetPreviewDecisions } from "../services/trailers/preview/previewDecision";
import { trailerMediaRoutes } from "./trailerMedia";
import { trailerPreviewRoutes } from "./trailerPreview";

const MOVIE = "0123456789abcdef0123456789abcdef";
const BOXSET = "33333333333333333333333333333333";
const YT = "Way9Dexny3w";
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const MASTER = `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/index.m3u8`;
const GV = "https://rr.googlevideo.test";

function googlevideo() {
  const pages: Record<string, string> = {
    [MASTER]: [
      "#EXTM3U",
      `#EXT-X-MEDIA:URI="${GV}/itag/234/a.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES`,
      `#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"\n${GV}/itag/232/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=3295980,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,AUDIO="234"\n${GV}/itag/270/v.m3u8`,
    ].join("\n"),
  };
  for (const itag of ["232", "270", "234"]) pages[`${GV}/itag/${itag}/${itag === "234" ? "a" : "v"}.m3u8`] = `#EXTM3U\n#EXTINF:5,\n${GV}/seg/${itag}/0.ts\n#EXT-X-ENDLIST\n`;
  return vi.fn(async (url: string) => {
    if (url.includes("/seg/")) return new Response(new Uint8Array([0x47, 1, 2, 3]), { headers: { "content-type": "video/mp2t" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

const youtube = (ytId: string): TrailerCatalogResponse => ({
  entries: [{ scope: { kind: "movie" }, playback: { kind: "youtube", ytId }, name: "Bande-annonce VF", version: "localized", type: "trailer", source: "tmdb" }],
  complete: true,
  language: "fr",
});
const EMPTY: TrailerCatalogResponse = { entries: [], complete: true, language: "fr" };

/** Le catalogue factice : le film pour qui le voit (« intrus » non), rien pour une collection ; TMDB selon `tmdbCatalog`. */
async function catalog(request: Record<string, unknown>, account: string): Promise<TrailerCatalogResponse> {
  if ("itemId" in request) return request.itemId === MOVIE && !account.startsWith("intrus") ? youtube(YT) : EMPTY;
  return tmdbCatalog(Number(request.tmdbId));
}

async function server(corsOrigins = "") {
  const app = Fastify();
  await app.register(cors, { delegator: tentacleCorsDelegator(parseCorsOrigins(corsOrigins)) });
  await app.register(trailerPreviewRoutes, { prefix: "/api/trailers" });
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  return app;
}

const get = (app: Awaited<ReturnType<typeof server>>, query: string, token = "alice", headers: Record<string, string> = {}) =>
  app.inject({ url: `/api/trailers/preview?${query}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } });

beforeEach(() => {
  resetTrailerRelay();
  resetHeldSegments();
  resetYouTubeGuard();
  resetPreviewDecisions();
  vi.unstubAllGlobals();
  extractTrailerSource.mockReset().mockResolvedValue({
    ok: true, clients: ["visionos"], subtitles: [],
    source: { kind: "hls", masterUrl: MASTER, headers: {}, expiresAt: FUTURE * 1000, heights: [1080, 720] },
  });
  tmdbCatalog.mockReset().mockReturnValue(EMPTY);
  buildCatalog.mockReset().mockImplementation(catalog);
  jellyfinAdminFetch.mockReset();
  vi.stubGlobal("fetch", googlevideo());
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("GET /api/trailers/preview", () => {
  it("exige un compte connecté ; une demande illisible est refusée (400 invalid_request)", async () => {
    const app = await server();
    expect((await get(app, `itemId=${MOVIE}`, "")).statusCode).toBe(401);
    for (const query of ["", "lang=fr", "itemId=../../etc", `itemId=${MOVIE}&tmdbId=1&mediaType=movie`, "tmdbId=1&mediaType=person"]) {
      const res = await get(app, query);
      expect([res.statusCode, res.json()]).toEqual([400, { error: "invalid_request" }]);
    }
  });

  it("rend une bande-annonce vérifiée, relayée par ce serveur, que son jeton ouvre", async () => {
    const app = await server();
    const res = await get(app, `itemId=${MOVIE}&lang=fr`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    const body = res.json();
    expect(body).toEqual({
      ytId: YT,
      source: { kind: "youtube", ytId: YT },
      // La version du catalogue : une VOSTFR garde ses sous-titres incrustés (jamais rognée).
      version: "localized",
      // Un jeton d'APERÇU (`.p.`) : la vidéo oubliée par le relais ne se ré-extrait pas hors de cette route.
      path: expect.stringMatching(new RegExp(`^/api/trailers/hls/${YT}/master\\.m3u8\\?t=[0-9a-z]+\\.p\\.[\\w-]+$`)),
      mimeType: "application/vnd.apple.mpegurl",
      expiresAt: expect.any(Number),
      heights: [1080, 720],
      qualities: [
        { height: 1080, path: expect.stringMatching(new RegExp(`^/api/trailers/hls/${YT}/master-1080\\.m3u8\\?t=`)) },
        { height: 720, path: expect.stringMatching(new RegExp(`^/api/trailers/hls/${YT}/master-720\\.m3u8\\?t=`)) },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/googlevideo|youtube\.com/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    // Vérifiée : le maître et les listes de départ ont été lus AVANT la réponse.
    const asked = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => String(url));
    expect(asked).toEqual(expect.arrayContaining([MASTER, `${GV}/itag/232/v.m3u8`, `${GV}/itag/234/a.m3u8`]));
    const master = await app.inject({ url: body.path });
    expect([master.statusCode, master.body.includes("p/232.m3u8?t=")]).toEqual([200, true]);
    expect(extractTrailerSource).toHaveBeenCalledWith(YT, expect.objectContaining({ priority: "preview", budgetMs: 20_000 }));
  });

  it("les premiers segments du départ de l'aperçu (720p et son audio) sont lus d'avance, puis servis sans relire googlevideo", async () => {
    const app = await server();
    const { path } = (await get(app, `itemId=${MOVIE}&lang=fr`)).json() as { path: string };
    const token = path.split("?t=")[1];
    await new Promise((resolve) => setTimeout(resolve, 20));
    const upstream = globalThis.fetch as ReturnType<typeof vi.fn>;
    const segmentsRead = () => upstream.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/seg/"));
    expect(segmentsRead()).toEqual([`${GV}/seg/232/0.ts`, `${GV}/seg/234/0.ts`]);
    for (const key of ["232", "234"]) {
      const res = await app.inject({ url: `/api/trailers/hls/${YT}/s/${key}/0.ts?t=${token}` });
      expect([res.statusCode, res.headers["content-type"], res.rawPayload.length]).toEqual([200, "video/mp2t", 4]);
    }
    expect(segmentsRead()).toHaveLength(2);
  });

  it("un titre que le compte ne voit pas, une collection : 404 no_trailer ; Jellyfin muet : 404 unavailable", async () => {
    const app = await server();
    expect((await get(app, `itemId=${MOVIE}`, "intrus")).json()).toEqual({ error: "no_trailer" });
    expect((await get(app, `itemId=${BOXSET}`)).json()).toEqual({ error: "no_trailer" });
    expect((await get(app, `itemId=${MOVIE}`, "muet")).json()).toEqual({ error: "unavailable" });
    // Ce qu'un compte ne voit pas ne décide rien pour les autres.
    expect(buildCatalog).not.toHaveBeenCalled();
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("le catalogue, au nom du compte, pour CE titre ; encore vide (une source finit en fond) : 429, dans 3 s", async () => {
    buildCatalog.mockResolvedValueOnce({ entries: [], complete: false, language: "fr" });
    const app = await server();
    const res = await get(app, `itemId=${MOVIE}`, "bob");
    expect([res.statusCode, res.json()]).toEqual([429, { error: "rate_limited", retryAfterS: 3 }]);
    expect(buildCatalog).toHaveBeenCalledWith({ itemId: MOVIE }, "bob".padEnd(32, "0"));
  });

  it("une vidéo AlloCiné (Dailymotion) n'est servie qu'au client qui la demande (dm=1)", async () => {
    tmdbCatalog.mockReturnValue({
      entries: [{ scope: { kind: "movie" }, playback: { kind: "dailymotion", videoId: "x8abcde" }, name: "VF", version: "localized", type: "trailer", source: "allocine" }],
      complete: true,
      language: "fr",
    });
    const app = await server();
    // Un client d'avant (sans dm=1) : rien de ce qu'il ne sait pas lire.
    expect((await get(app, "tmdbId=603&mediaType=movie&lang=fr")).json()).toEqual({ error: "no_trailer" });
    expect(buildCatalog).toHaveBeenCalledTimes(1);
  });

  it("un titre TMDB hors bibliothèque ; aucune bande-annonce : 404 no_trailer ; aucune lisible : 404 unavailable", async () => {
    const app = await server();
    expect((await get(app, "tmdbId=693134&mediaType=movie&lang=fr")).json()).toEqual({ error: "no_trailer" });
    expect(buildCatalog).toHaveBeenCalledWith({ tmdbId: 693134, mediaType: "movie", lang: "fr" }, "alice".padEnd(32, "0"));
    tmdbCatalog.mockReturnValue(youtube(YT));
    expect((await get(app, "tmdbId=157336&mediaType=movie&lang=fr")).json()).toMatchObject({ ytId: YT });
    extractTrailerSource.mockResolvedValue({ ok: false, permanent: true, timedOut: false, reason: "Private video" });
    resetTrailerRelay();
    const res = await get(app, "tmdbId=438631&mediaType=movie&lang=fr");
    expect([res.statusCode, res.json()]).toEqual([404, { error: "unavailable" }]);
  });

  it("YouTube bride l'adresse : 404 unavailable tout de suite, sans extraction ; budget de l'heure épuisé : 429 et son délai", async () => {
    const app = await server();
    tripYouTubeBreaker("bot");
    const blocked = await get(app, `itemId=${MOVIE}&lang=fr`);
    expect([blocked.statusCode, blocked.json()]).toEqual([404, { error: "unavailable" }]);
    expect(extractTrailerSource).not.toHaveBeenCalled();
    resetYouTubeGuard();
    for (let i = 0; i < 30; i++) countPreviewExtraction();
    const limited = await get(app, `itemId=${MOVIE}&lang=fr`);
    expect([limited.statusCode, limited.headers["retry-after"], limited.json()]).toEqual([429, "3600", { error: "rate_limited", retryAfterS: 3600 }]);
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("une session de profil (TV, invité de la Famille) y a droit : c'est regarder", async () => {
    const guest = { userId: "c".repeat(32), username: "invité", session: "tvProfile" };
    expect(await profileSessionScope(`/api/trailers/preview?itemId=${MOVIE}&lang=fr`, guest)).toEqual({ kind: "pass" });
    // À côté, ce qu'un invité n'a pas : la règle est bien celle des invités.
    expect((await profileSessionScope("/api/watch-together/group", guest)).kind).toBe("refuse");
    const app = await server();
    expect((await get(app, `itemId=${MOVIE}&lang=fr`, "profil-invite")).statusCode).toBe(200);
  });

  it("trop d'aperçus à décider d'affilée : 429 rate_limited — le délai dans Retry-After (lisible depuis le bureau) ET dans le corps", async () => {
    const app = await server("https://tentacle.example.com");
    const origin = { origin: "tentacle://app" };
    for (let n = 1; n <= 6; n++) expect((await get(app, `tmdbId=${n}&mediaType=movie`, "alice", origin)).statusCode).toBe(404);
    const res = await get(app, "tmdbId=7&mediaType=movie", "alice", origin);
    expect([res.statusCode, res.json(), res.headers["retry-after"]]).toEqual([429, { error: "rate_limited", retryAfterS: 5 }, "5"]);
    expect(res.headers["access-control-allow-origin"]).toBe("tentacle://app");
    expect(String(res.headers["access-control-expose-headers"])).toContain("Retry-After");
  });

  it("le relais est lisible depuis l'origine du bureau, CORS ouvert ou restreint", async () => {
    for (const corsOrigins of ["", "https://tentacle.example.com"]) {
      resetPreviewDecisions();
      const app = await server(corsOrigins);
      const origin = { origin: "tentacle://app" };
      const preview = await get(app, `itemId=${MOVIE}&lang=fr`, "alice", origin);
      expect(preview.headers["access-control-allow-origin"]).toBe("tentacle://app");
      const path: string = preview.json().path;
      const token = path.split("?t=")[1];
      for (const url of [path, `/api/trailers/hls/${YT}/p/232.m3u8?t=${token}`, `/api/trailers/hls/${YT}/s/232/0.ts?t=${token}`]) {
        const res = await app.inject({ url, headers: origin });
        expect([url.split("?")[0], res.statusCode, res.headers["access-control-allow-origin"]]).toEqual([url.split("?")[0], 200, "tentacle://app"]);
      }
    }
  });

  it("est enregistrée par le serveur sous /api/trailers", () => {
    // Les routes de l'application sont posées par `applicationRoutes.ts` (appelé par index.ts).
    const routes = readFileSync(join(__dirname, "applicationRoutes.ts"), "utf8");
    expect(routes).toMatch(/app\.register\(trailerPreviewRoutes, \{ prefix: "\/api\/trailers" \}\)/);
  });
});
