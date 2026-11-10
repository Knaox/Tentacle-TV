/**
 * Le relais en CODECS LIBRES, de bout en bout, sans réseau : un lecteur sans
 * H.264 ni AAC (le bureau CEF) le DÉCLARE (`dec=vp9,opus`) et reçoit l'entrée
 * libre de la vidéo (`o:<id>`) — le maître réduit au VP9, l'Opus de YouTube
 * réemballé en piste audio. Une extraction sert les deux flux ; un serveur qui
 * ne déclare pas `trailers.openCodecs` ne l'improvise pas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";

const { extractTrailerSource, declared } = vi.hoisted(() => ({
  extractTrailerSource: vi.fn<(ytId: string) => Promise<ExtractionResult>>(),
  declared: { open: true },
}));
vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource }));
vi.mock("../services/ytDlp", () => ({ startYtDlpUpdates: () => {} }));
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers.authorization !== "Bearer ok") return reply.status(401).send({ message: "Unauthorized" });
  },
}));
vi.mock("../serverCapabilities/declaredCapabilities", () => ({ isCapabilityDeclared: (key: string) => key !== "trailers.openCodecs" || declared.open }));

import { FUTURE, ID, masterUrl, server } from "./trailerMediaTestKit";
import { OPUS_WEBM, opusRangeResponse } from "../services/trailers/open/opusFixture";
import { heldEntry, resetTrailerRelay } from "../services/trailers/trailerRelay";
import { resetHeldSegments } from "../services/trailers/trailerSegments";

const OPUS_URL = `https://rr.googlevideo.test/videoplayback?expire=${FUTURE}&itag=251`;
const AUTH = { authorization: "Bearer ok" };

/** L'extraction d'une vidéo qui s'offre aussi en VP9 + Opus (`open`), ou seulement en H.264. */
const extraction = (open = true): ExtractionResult => ({
  ok: true, clients: ["visionos"], subtitles: [],
  source: {
    kind: "hls", masterUrl: masterUrl(1), headers: {}, expiresAt: FUTURE * 1000, heights: [1080, 720],
    ...(open ? { open: { heights: [1080, 720], opus: [{ url: OPUS_URL, headers: {}, bitrate: 124, tag: { content: "unknown" as const } }] } } : {}),
  },
});

/** googlevideo factice : le maître aux deux codecs, une liste VP9, et le WebM Opus servi par plages. */
function googlevideo() {
  const gv = "https://rr.googlevideo.test/gen/1";
  const pages: Record<string, string> = {
    [masterUrl(1)]: [
      "#EXTM3U",
      '#EXT-X-MEDIA:URI="https://rr.googlevideo.test/gen/1/itag/234/a.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES,AUTOSELECT=YES',
      `#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"\n${gv}/itag/232/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=1006437,CODECS="vp09.00.31.08,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"\n${gv}/itag/609/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=2283500,CODECS="vp09.00.40.08,mp4a.40.2",RESOLUTION=1920x1080,AUDIO="234"\n${gv}/itag/614/v.m3u8`,
    ].join("\n"),
    [`${gv}/itag/609/v.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXT-X-MAP:URI="${gv}/itag/609/init"\n#EXTINF:5,\n${gv}/itag/609/sq/0\n#EXT-X-ENDLIST\n`,
    [`${gv}/itag/232/v.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\n${gv}/itag/232/sq/0.ts\n#EXT-X-ENDLIST\n`,
    [`${gv}/itag/234/a.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\n${gv}/itag/234/sq/0.ts\n#EXT-X-ENDLIST\n`,
  };
  return vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    if (url === OPUS_URL) return opusRangeResponse(init?.headers?.Range);
    if (url.endsWith("/sq/0") || url.endsWith("/init")) return new Response(new Uint8Array([0, 0, 0, 8]), { headers: { "content-type": "application/octet-stream" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

const resolveOpen = async (app: Awaited<ReturnType<typeof server>>) =>
  app.inject({ url: `/api/trailers/resolve?ytId=${ID}&dec=vp9,opus`, headers: AUTH });

beforeEach(() => {
  resetTrailerRelay();
  resetHeldSegments();
  extractTrailerSource.mockReset();
  declared.open = true;
});
afterEach(() => vi.unstubAllGlobals());

describe("le relais en codecs libres (`dec=vp9,opus`)", () => {
  it("rend l'entrée libre de la vidéo : un maître VP9 dont l'audio est l'Opus du relais", async () => {
    extractTrailerSource.mockResolvedValue(extraction());
    vi.stubGlobal("fetch", googlevideo());
    const app = await server();
    const res = await resolveOpen(app);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.path).toMatch(new RegExp(`^/api/trailers/hls/o%3A${ID}/master\\.m3u8\\?t=[\\w.-]+$`));
    expect(body.qualities.map((q: { height: number }) => q.height)).toEqual([1080, 720]);

    const master = (await app.inject({ url: body.path })).body;
    expect(master).toContain('CODECS="vp09.00.31.08,opus"');
    expect(master).toContain('URI="p/opus.m3u8?t=');
    expect(master).not.toMatch(/avc1|mp4a|googlevideo/);

    const base = body.path.replace(/master\.m3u8.*$/, "");
    const token = body.path.split("?t=")[1];
    const playlist = await app.inject({ url: `${base}p/opus.m3u8?t=${token}` });
    expect(playlist.statusCode).toBe(200);
    expect(playlist.body).toContain(`#EXT-X-MAP:URI="../s/opus/init.mp4?t=${token}"`);
    expect(playlist.body.match(/#EXTINF/g)?.length).toBe(3);
    expect(playlist.body).not.toContain("googlevideo");
  });

  it("sert chaque segment de la piste : la grappe lue par plage, réemballée en MP4 fragmenté", async () => {
    extractTrailerSource.mockResolvedValue(extraction());
    const upstream = googlevideo();
    vi.stubGlobal("fetch", upstream);
    const app = await server();
    const { path } = (await resolveOpen(app)).json();
    const base = path.replace(/master\.m3u8.*$/, "");
    const token = path.split("?t=")[1];

    const init = await app.inject({ url: `${base}s/opus/init.mp4?t=${token}` });
    expect(init.statusCode).toBe(200);
    expect(init.headers["content-type"]).toBe("audio/mp4");
    expect(init.rawPayload.subarray(4, 8).toString("latin1")).toBe("ftyp");

    const segment = await app.inject({ url: `${base}s/opus/1.ts?t=${token}` });
    expect(segment.statusCode).toBe(200);
    expect(segment.rawPayload.subarray(4, 8).toString("latin1")).toBe("moof");
    // La plage demandée à googlevideo est celle de LA grappe, pas le fichier.
    const ranges = upstream.mock.calls.filter(([url]) => url === OPUS_URL).map(([, init2]) => init2?.headers?.Range);
    const cluster = heldEntry(`o:${ID}`)?.opus?.index.cues ?? [];
    expect(ranges).toContain(`bytes=${cluster[1].offset}-${cluster[2].offset - 1}`);
    expect(ranges[0]).toBe("bytes=0-65535");
    // Au-delà de la dernière grappe : rien.
    expect((await app.inject({ url: `${base}s/opus/3.ts?t=${token}` })).statusCode).toBe(404);
    expect(OPUS_WEBM.length).toBeGreaterThan(cluster[2].offset);
  });

  it("une extraction sert les deux flux : H.264 puis libre, YouTube n'est demandé qu'une fois", async () => {
    extractTrailerSource.mockResolvedValue(extraction());
    vi.stubGlobal("fetch", googlevideo());
    const app = await server();
    const h264 = (await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: AUTH })).json();
    expect(h264.path).toContain(`/hls/${ID}/master.m3u8`);
    const open = (await resolveOpen(app)).json();
    expect(open.path).toContain(`/hls/o%3A${ID}/master.m3u8`);
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
    // Chacun son maître : le H.264 n'a pas bougé.
    const master = (await app.inject({ url: h264.path })).body;
    expect(master).toContain("avc1.4D401F");
    expect(master).not.toMatch(/vp09|opus/);
    // Le jeton d'une entrée n'ouvre pas l'autre.
    const foreign = open.path.replace(`o%3A${ID}`, ID);
    expect((await app.inject({ url: foreign })).statusCode).toBe(403);
  });

  it("une vidéo sans VP9 ni Opus n'a pas d'entrée libre — mais son extraction sert le H.264", async () => {
    extractTrailerSource.mockResolvedValue(extraction(false));
    vi.stubGlobal("fetch", googlevideo());
    const app = await server();
    expect((await resolveOpen(app)).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: AUTH })).statusCode).toBe(200);
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
  });

  it("Dailymotion n'existe qu'en H.264 : rien pour ce lecteur, sans rien demander", async () => {
    const app = await server();
    expect((await app.inject({ url: "/api/trailers/resolve?dmId=x8e90ff&dec=vp9,opus", headers: AUTH })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/trailers/prepare?dmId=x8e90ff&dec=vp9,opus", headers: AUTH })).json()).toEqual({ status: "skipped" });
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("un lecteur qui ne décode rien de servable ne reçoit rien ; H.264 + AAC déclarés : le flux de toujours", async () => {
    extractTrailerSource.mockResolvedValue(extraction());
    vi.stubGlobal("fetch", googlevideo());
    const app = await server();
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}&dec=opus`, headers: AUTH })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/trailers/resolve?ytId=${ID}&dec=`, headers: AUTH })).statusCode).toBe(404);
    expect(extractTrailerSource).not.toHaveBeenCalled();
    const both = (await app.inject({ url: `/api/trailers/resolve?ytId=${ID}&dec=h264,aac,vp9,opus`, headers: AUTH })).json();
    expect(both.path).toContain(`/hls/${ID}/master.m3u8`);
  });

  it("un serveur qui ne déclare pas `trailers.openCodecs` ne sert pas le flux libre", async () => {
    declared.open = false;
    extractTrailerSource.mockResolvedValue(extraction());
    vi.stubGlobal("fetch", googlevideo());
    const app = await server();
    expect((await resolveOpen(app)).statusCode).toBe(404);
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });
});
