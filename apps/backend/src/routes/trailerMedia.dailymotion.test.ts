/**
 * Le relais lit Dailymotion (les bandes-annonces d'AlloCiné) comme YouTube :
 * `/resolve?dmId=` rend un flux servi par CE serveur, les qualités lues dans le
 * maître, les listes aux URI relatives `../../../frag(1)/…` réécrites, et les
 * segments relus à la bonne adresse. Dailymotion est factice, dans la forme
 * relevée le 2026-10-14 ; l'auth est réduite à « un jeton ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/trailers/ytExtract", () => ({ extractTrailerSource: vi.fn() }));
vi.mock("../services/ytDlp", () => ({ startYtDlpUpdates: () => {} }));
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers.authorization !== "Bearer ok") return reply.status(401).send({ message: "Unauthorized" });
  },
}));

import { server } from "./trailerMediaTestKit";
import { resetTrailerRelay } from "../services/trailers/trailerRelay";
import { setTitleLanguage } from "../services/reco/titleLanguage";

const DM = "x8e90ff";
const AUTH = { authorization: "Bearer ok" };
const MASTER = `https://cdndirector.dailymotion.com/cdn/manifest/video/${DM}.m3u8?sec=abc`;
const CDN = "https://vod2.cf.dmcdn.net/sec2(tok)/cloud/194/466";
const SEGMENT = "https://vod2.cf.dmcdn.net/sec2(tok)/frag(1)/cloud/194/466/507664491_mp4_h264_aac_hd.ts";

/** Les métadonnées, le maître (480p, 288p, 720p) et une liste de segments à URI relatives. */
function dailymotion() {
  const pages: Record<string, string> = {
    [`https://www.dailymotion.com/player/metadata/video/${DM}`]: JSON.stringify({
      id: DM, advertising: { ad_url: "https://dmxleo.dailymotion.com/cdn/manifest/video/x.m3u8?auth=pub" },
      qualities: { auto: [{ type: "application/x-mpegURL", url: MASTER }] },
    }),
    [MASTER]: [
      "#EXTM3U",
      '#EXT-X-STREAM-INF:BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x480,NAME="480"',
      `${CDN}/507664491_mp4_h264_aac_hq.m3u8#cell=cf2`,
      '#EXT-X-STREAM-INF:BANDWIDTH=460560,CODECS="mp4a.40.2,avc1.42001e",RESOLUTION=512x288,NAME="380"',
      `${CDN}/507664491_mp4_h264_aac.m3u8#cell=cf2`,
      '#EXT-X-STREAM-INF:BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x720,NAME="720"',
      `${CDN}/507664491_mp4_h264_aac_hd.m3u8#cell=cf2`,
    ].join("\n"),
    [`${CDN}/507664491_mp4_h264_aac_hd.m3u8`]:
      "#EXTM3U\n#EXT-X-VERSION:5\n#EXT-X-TARGETDURATION:3\n#EXTINF:3.000000,\n../../../frag(1)/cloud/194/466/507664491_mp4_h264_aac_hd.ts\n#EXT-X-ENDLIST\n",
  };
  return vi.fn(async (input: string) => {
    const url = input.replace(/#.*$/, "");
    if (url === SEGMENT) return new Response(new Uint8Array([0x47, 9]), { headers: { "content-type": "video/mp2t" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

beforeEach(() => {
  resetTrailerRelay();
  setTitleLanguage("fr-FR");
});
afterEach(() => {
  vi.unstubAllGlobals();
  setTitleLanguage(undefined);
});

describe("relais Dailymotion", () => {
  it("rend un flux relayé, sans publicité, ses qualités lues dans le maître", async () => {
    const upstream = dailymotion();
    vi.stubGlobal("fetch", upstream);
    const app = await server();
    const res = await app.inject({ url: `/api/trailers/resolve?dmId=${DM}`, headers: AUTH });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.path).toMatch(/^\/api\/trailers\/hls\/dm%3Ax8e90ff\/master\.m3u8\?t=[\w.-]+$/);
    expect(body.qualities.map((q: { height: number }) => q.height)).toEqual([720, 480]);
    expect(body.subtitles).toEqual([]);
    expect(body.language).toBe("fr-FR");
    expect(JSON.stringify(body)).not.toMatch(/dmcdn|dailymotion\.com/);
    expect(upstream.mock.calls.some(([url]) => String(url).includes("dmxleo"))).toBe(false);
  });

  it("relaie le maître, la liste aux URI relatives et le segment", async () => {
    vi.stubGlobal("fetch", dailymotion());
    const app = await server();
    const { path } = (await app.inject({ url: `/api/trailers/resolve?dmId=${DM}`, headers: AUTH })).json();
    const master = await app.inject({ url: path });
    expect(master.statusCode).toBe(200);
    const variant = master.body.split("\n").find((l: string) => l.startsWith("p/") && master.body.indexOf(l) > master.body.indexOf("1280x720"));
    expect(variant).toBeDefined();
    const media = await app.inject({ url: new URL(variant as string, `http://h${path}`).pathname + `?${(variant as string).split("?")[1]}` });
    expect(media.statusCode).toBe(200);
    const segment = media.body.split("\n").find((l: string) => l.includes(".ts"));
    const relayed = await app.inject({ url: new URL(segment as string, `http://h${new URL(variant as string, `http://h${path}`).pathname}`).pathname + `?${(segment as string).split("?")[1]}` });
    expect(relayed.statusCode).toBe(200);
    expect([...relayed.rawPayload]).toEqual([0x47, 9]);
  });

  it("refuse un jeton d'une autre vidéo, et dit « indisponible » sans métadonnées", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "404", type: "not_found" } }))));
    const app = await server();
    expect((await app.inject({ url: "/api/trailers/resolve?dmId=x0000zz", headers: AUTH })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/trailers/hls/dm%3Ax0000zz/master.m3u8?t=forged" })).statusCode).toBe(403);
    expect((await app.inject({ url: "/api/trailers/resolve?dmId=x8/../a", headers: AUTH })).statusCode).toBe(400);
  });

  it("accepte le compte rendu d'une lecture Dailymotion", async () => {
    const app = await server();
    const report = (body: unknown) => app.inject({ method: "POST", url: "/api/trailers/report", headers: AUTH, payload: body as object });
    expect((await report({ dmId: DM, ok: true, ms: 420 })).statusCode).toBe(204);
    expect((await report({ ytId: "Way9Dexny3w", dmId: DM, ok: true, ms: 1 })).statusCode).toBe(400);
    expect((await report({ ok: true, ms: 1 })).statusCode).toBe(400);
  });
});
