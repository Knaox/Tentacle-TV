/**
 * Le relais des bandes-annonces de bout en bout, sans réseau : `/resolve` rend
 * un flux servi par CE serveur (jamais une URL googlevideo), le jeton de l'URL
 * ouvre le maître, les listes et les segments de SA vidéo seulement, et un
 * segment que googlevideo ne sert plus est relu après une nouvelle extraction.
 * yt-dlp et googlevideo sont factices ; l'auth est réduite à « un jeton ».
 */

import compress from "@fastify/compress";
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
import { mediaCacheControl, playlistCacheControl, trailerMediaRoutes } from "./trailerMedia";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";
import { signRelayToken } from "../services/trailers/relayToken";

const ID = "Way9Dexny3w";
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const masterUrl = (gen: number) => `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/gen/${gen}/index.m3u8`;
const timedtext = (gen: number, lang: string) => `https://www.youtube.com/api/timedtext?v=${ID}&gen=${gen}&lang=${lang}&fmt=json3`;
const hls = (gen: number): ExtractionResult => ({
  ok: true,
  clients: ["visionos"],
  source: { kind: "hls", masterUrl: masterUrl(gen), headers: {}, expiresAt: FUTURE * 1000, heights: [1080, 720] },
  subtitles: [
    { key: "m-en", lang: "en", label: "English", auto: false, url: timedtext(gen, "en"), format: "json3" },
    { key: "a-fr", lang: "fr", label: "French", auto: true, url: timedtext(gen, "fr"), format: "json3" },
  ],
});

/** googlevideo factice, génération `gen` : les URL d'une extraction précédente répondent 403. */
function googlevideo(gen: number) {
  const gv = `https://rr.googlevideo.test/gen/${gen}`;
  const pages: Record<string, string> = {
    [masterUrl(gen)]: [
      "#EXTM3U",
      `#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720\n${gv}/itag/95/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=3295980,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080\n${gv}/itag/96/v.m3u8`,
    ].join("\n"),
    [timedtext(gen, "en")]: JSON.stringify({ events: [{ tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: "Hello <there>" }] }] }),
    [`${gv}/itag/95/v.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\n${gv}/itag/95/sq/0.ts\n#EXT-X-ENDLIST\n`,
  };
  return vi.fn(async (url: string) => {
    if (url === `${gv}/itag/95/sq/0.ts`) return new Response(new Uint8Array([0x47, 1, 2, 3]), { headers: { "content-type": "video/mp2t" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

async function server({ compressed = false } = {}) {
  const app = Fastify();
  // Comme le serveur (index.ts) : la compression globale, dès 1 Ko.
  if (compressed) await app.register(compress, { threshold: 1024 });
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
    expect(JSON.stringify(body)).not.toContain("youtube.com");
    // Les ajouts du lecteur (capacité `trailers.player`) : une qualité par hauteur, les pistes relayées.
    expect(body.qualities.map((q: { height: number }) => q.height)).toEqual([1080, 720]);
    expect(body.qualities[1].path).toMatch(new RegExp(`^/api/trailers/hls/${ID}/master-720\\.m3u8\\?t=`));
    // Sans langue d'interface, l'anglais en tête.
    expect(body.subtitles.map((s: { lang: string; auto: boolean }) => [s.lang, s.auto])).toEqual([["en", false], ["fr", true]]);
    expect(body.subtitles[0].path).toMatch(new RegExp(`^/api/trailers/subs/${ID}/m-en\\.vtt\\?t=`));
  });

  it("met la langue de l'interface en tête des sous-titres ; un MP4 n'a pas de qualités", async () => {
    const withTracks = hls(1);
    extractTrailerSource.mockResolvedValue({
      ok: true, clients: ["web_embedded"], subtitles: withTracks.ok ? withTracks.subtitles : [],
      source: { kind: "progressive", url: "https://rr.googlevideo.test/f.mp4", headers: {}, expiresAt: FUTURE * 1000 },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("mp4")));
    const app = await server();
    const body = (await app.inject({ url: `/api/trailers/resolve?ytId=${ID}&lang=fr`, headers: { authorization: "Bearer ok" } })).json();
    expect(body.qualities).toEqual([]);
    expect(body.subtitles.map((s: { lang: string }) => s.lang)).toEqual(["fr", "en"]);
  });

  it("dit « indisponible » sans flux, et prépare sans attendre", async () => {
    extractTrailerSource.mockResolvedValue({ ok: false, permanent: true, timedOut: false, reason: "Private video" });
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

  it("servent le maître réduit à une qualité, et « Auto » pour une hauteur inconnue", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const token = new URL(await resolved(app), "http://x").searchParams.get("t");
    const fixed = await app.inject({ url: `/api/trailers/hls/${ID}/master-1080.m3u8?t=${token}` });
    expect(fixed.statusCode).toBe(200);
    expect(fixed.body).toContain(`p/96.m3u8?t=${token}`);
    expect(fixed.body).not.toContain("p/95.m3u8");
    const unknown = await app.inject({ url: `/api/trailers/hls/${ID}/master-480.m3u8?t=${token}` });
    expect(unknown.body).toContain("p/95.m3u8");
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/other.m3u8?t=${token}` })).statusCode).toBe(404);
  });

  it("servent les sous-titres en WebVTT, sous le même jeton", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const token = new URL(await resolved(app), "http://x").searchParams.get("t");
    expect((await app.inject({ url: `/api/trailers/subs/${ID}/m-en.vtt` })).statusCode).toBe(403);
    const vtt = await app.inject({ url: `/api/trailers/subs/${ID}/m-en.vtt?t=${token}` });
    expect(vtt.statusCode).toBe(200);
    expect(vtt.headers["content-type"]).toContain("text/vtt");
    expect(vtt.body).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello &lt;there&gt;\n");
    // Une piste que la vidéo n'offre pas, ou que YouTube ne sert plus : 404, jamais une erreur.
    expect((await app.inject({ url: `/api/trailers/subs/${ID}/m-de.vtt?t=${token}` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/trailers/subs/${ID}/a-fr.vtt?t=${token}` })).statusCode).toBe(404);
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

  it("ne recompressent jamais la vidéo, même dite `application/octet-stream` par googlevideo ; la liste, si", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const pages = googlevideo(1);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/sq/0.ts")
      ? new Response(new Uint8Array(64 * 1024).fill(0x47), { headers: { "content-type": "application/octet-stream" } })
      : pages(url))));
    const app = await server({ compressed: true });
    const token = new URL(await resolved(app), "http://x").searchParams.get("t");
    const headers = { "accept-encoding": "gzip, deflate, br, zstd" };
    const segment = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}`, headers });
    expect([segment.statusCode, segment.headers["content-encoding"], segment.rawPayload.length]).toEqual([200, undefined, 64 * 1024]);
    const media = await app.inject({ url: `/api/trailers/hls/${ID}/p/95.m3u8?t=${token}`, headers });
    expect(media.statusCode).toBe(200);
  });

  it("un jeton d'APERÇU ne fait jamais ré-extraire : vidéo oubliée → 404, URL refusée → 404 ; un jeton de lecture, si", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const preview = signRelayToken(ID, Date.now(), "preview");
    // Le relais ne tient pas la vidéo (évincée, serveur relancé) : rien n'est extrait pour un aperçu.
    for (const url of [
      `/api/trailers/hls/${ID}/master.m3u8`, `/api/trailers/hls/${ID}/master-1080.m3u8`, `/api/trailers/hls/${ID}/p/95.m3u8`,
      `/api/trailers/hls/${ID}/s/95/0.ts`, `/api/trailers/file/${ID}.mp4`, `/api/trailers/subs/${ID}/m-en.vtt`,
    ]) {
      const res = await app.inject({ url: `${url}?t=${preview}` });
      expect([url, res.statusCode]).toEqual([url, 404]);
    }
    expect(extractTrailerSource).not.toHaveBeenCalled();
    // Le même oubli avec un jeton de lecture : une extraction, comme toujours.
    const play = signRelayToken(ID, Date.now());
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/master.m3u8?t=${play}` })).statusCode).toBe(200);
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
    // Tenue par le relais, la vidéo s'ouvre avec le jeton d'aperçu ; une URL que googlevideo refuse ne fait pas ré-extraire.
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/master.m3u8?t=${preview}` })).statusCode).toBe(200);
    await app.inject({ url: `/api/trailers/hls/${ID}/p/95.m3u8?t=${preview}` });
    vi.stubGlobal("fetch", googlevideo(2));
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${preview}` })).statusCode).toBe(404);
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
  });

  it("un APERÇU reste dans le cache du navigateur — listes et segments, immuables jusqu'à l'échéance du jeton ; une lecture ne garde pas ses listes", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    vi.stubGlobal("fetch", googlevideo(1));
    const app = await server();
    const play = new URL(await resolved(app), "http://x").searchParams.get("t") as string;
    const preview = signRelayToken(ID, Date.now(), "preview");
    for (const name of ["master.m3u8", "master-1080.m3u8", "p/95.m3u8"]) {
      expect((await app.inject({ url: `/api/trailers/hls/${ID}/${name}?t=${preview}` })).headers["cache-control"]).toBe("private, max-age=3600, immutable");
      expect((await app.inject({ url: `/api/trailers/hls/${ID}/${name}?t=${play}` })).headers["cache-control"]).toBe("private, no-store");
    }
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${preview}` })).headers["cache-control"]).toBe("private, max-age=3600, immutable");
    expect((await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${play}` })).headers["cache-control"]).toBe("private, max-age=3600");
    // Près de son échéance, un jeton d'aperçu ne se garde plus qu'une minute avant elle — puis plus du tout.
    const expiry = (parseInt(preview.split(".")[0], 36)) * 1000;
    const access = { token: preview, scope: "preview" as const };
    expect(playlistCacheControl(access, expiry - 10 * 60_000)).toBe("private, max-age=540, immutable");
    expect(mediaCacheControl(access, expiry - 30_000)).toBe("private, no-store");
  });

  it("un refus PASSAGER de googlevideo (503, 429) est relayé tel quel, jamais gardé par le navigateur : la reprise de hls.js le redemande", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const pages = googlevideo(1);
    let status = 503;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/sq/") ? new Response("busy", { status }) : pages(url))));
    const app = await server();
    const preview = signRelayToken(ID, Date.now(), "preview");
    const play = new URL(await resolved(app), "http://x").searchParams.get("t") as string;
    for (const token of [preview, play]) {
      const res = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}` });
      expect([res.statusCode, res.headers["cache-control"]]).toEqual([503, "private, no-store"]);
    }
    status = 429;
    const res = await app.inject({ url: `/api/trailers/hls/${ID}/s/95/0.ts?t=${preview}` });
    expect([res.statusCode, res.headers["cache-control"]]).toEqual([429, "private, no-store"]);
  });

  it("une panne amont se dit en 502, un délai en 504 — jamais en 500", async () => {
    extractTrailerSource.mockResolvedValue(hls(1));
    const pages = googlevideo(1);
    let failure: Error = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/sq/")) throw failure;
      return pages(url);
    }));
    const app = await server();
    const token = new URL(await resolved(app), "http://x").searchParams.get("t");
    const url = `/api/trailers/hls/${ID}/s/95/0.ts?t=${token}`;
    expect([(await app.inject({ url })).statusCode, (await app.inject({ url })).json()]).toEqual([502, { error: "upstream" }]);
    failure = new DOMException("délai", "TimeoutError");
    expect((await app.inject({ url })).statusCode).toBe(504);
  });
});
