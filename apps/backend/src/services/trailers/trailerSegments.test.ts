/**
 * Les premiers segments lus d'avance pour l'aperçu : son départ (la variante
 * la plus riche jusqu'à 720p — un aperçu part du niveau qui couvre sa
 * mini-carte — et l'audio de son groupe), servi de la mémoire
 * ou en rejoignant la lecture en cours, dans une mémoire bornée. yt-dlp et
 * googlevideo sont factices.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "./ytExtract";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string, options?: unknown) => Promise<ExtractionResult>>() }));
vi.mock("./ytExtract", () => ({ extractTrailerSource }));
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));

import { resetTrailerRelay, resolveTrailer } from "./trailerRelay";
import { prepareTrailer, warmStart } from "./trailerPrepare";
import { heldSegment, heldSegmentsState, prefetchSegment, resetHeldSegments } from "./trailerSegments";

const ID = "Way9Dexny3w";
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const MASTER = `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/index.m3u8`;
const GV = "https://rr.googlevideo.test";
const MIB = 1024 * 1024;

/** googlevideo factice : 720p et 1080p (audio 234), 360p (audio 233) ; segments de `size` octets, servis après `delayMs`. */
function googlevideo({ size = 1000, delayMs = 0 } = {}) {
  const pages: Record<string, string> = {
    [MASTER]: [
      "#EXTM3U",
      `#EXT-X-MEDIA:URI="${GV}/itag/233/a.m3u8",TYPE=AUDIO,GROUP-ID="233",NAME="Default",DEFAULT=YES`,
      `#EXT-X-MEDIA:URI="${GV}/itag/234/a.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES`,
      `#EXT-X-STREAM-INF:BANDWIDTH=391943,CODECS="avc1.4D401E,mp4a.40.5",RESOLUTION=640x360,AUDIO="233"\n${GV}/itag/230/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=851688,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"\n${GV}/itag/232/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=2497308,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,AUDIO="234"\n${GV}/itag/270/v.m3u8`,
    ].join("\n"),
  };
  for (const itag of ["230", "232", "270", "233", "234"]) {
    pages[`${GV}/itag/${itag}/${["233", "234"].includes(itag) ? "a" : "v"}.m3u8`] =
      `#EXTM3U\n#EXTINF:5,\n${GV}/seg/${itag}/0.ts\n#EXTINF:5,\n${GV}/seg/${itag}/1.ts\n#EXT-X-ENDLIST\n`;
  }
  return vi.fn(async (url: string) => {
    if (url.includes("/seg/")) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return new Response(new Uint8Array(size).fill(0x47), { headers: { "content-type": "video/mp2t", "content-length": String(size) } });
    }
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  resetTrailerRelay();
  resetHeldSegments();
  extractTrailerSource.mockReset().mockResolvedValue({
    ok: true, clients: ["visionos"], subtitles: [],
    source: { kind: "hls", masterUrl: MASTER, headers: {}, expiresAt: FUTURE * 1000, heights: [1080, 720, 360] },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("départ de l'aperçu, lu d'avance", () => {
  it("la variante 720p (jamais la 1080p) et l'audio de SON groupe : leurs listes, puis leur premier segment", async () => {
    const fetch = googlevideo();
    vi.stubGlobal("fetch", fetch);
    await resolveTrailer(ID);
    await warmStart(ID);
    await settled();
    const asked = fetch.mock.calls.map(([url]) => String(url));
    expect(asked.filter((u) => u.includes("/seg/"))).toEqual([`${GV}/seg/232/0.ts`, `${GV}/seg/234/0.ts`]);
    expect(asked.some((u) => u.includes("/itag/233/") || u.includes("/itag/230/") || u.includes("/itag/270/"))).toBe(false);
    expect(heldSegmentsState()).toEqual({ count: 2, bytes: 2000, reading: 0 });
    expect((await heldSegment(ID, "232", 0))?.body.length).toBe(1000);
    expect(heldSegment(ID, "232", 1)).toBeNull();
  });

  it("sans effet sur une vidéo que le relais ne tient pas — jamais d'extraction pour anticiper", async () => {
    const fetch = googlevideo();
    vi.stubGlobal("fetch", fetch);
    await warmStart(ID);
    prefetchSegment(ID, "270", 0);
    expect(await heldSegment(ID, "270", 0)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(extractTrailerSource).not.toHaveBeenCalled();
  });

  it("un lecteur qui arrive pendant la lecture d'avance la rejoint : un seul téléchargement", async () => {
    const fetch = googlevideo({ delayMs: 30 });
    vi.stubGlobal("fetch", fetch);
    await prepareTrailer(ID);
    prefetchSegment(ID, "270", 0);
    prefetchSegment(ID, "270", 0);
    const early = heldSegment(ID, "270", 0);
    expect(early).not.toBeNull();
    expect((await early)?.contentType).toBe("video/mp2t");
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/seg/270/0.ts"))).toHaveLength(1);
  });
});

describe("mémoire bornée", () => {
  it("un segment trop gros n'est pas gardé ; quatre lectures d'avance à la fois au plus", async () => {
    vi.stubGlobal("fetch", googlevideo({ size: 9 * MIB }));
    await prepareTrailer(ID);
    prefetchSegment(ID, "270", 0);
    expect(await heldSegment(ID, "270", 0)).toBeNull();
    vi.stubGlobal("fetch", googlevideo({ delayMs: 30 }));
    for (const [key, index] of [["270", 0], ["270", 1], ["232", 0], ["232", 1], ["234", 0]] as const) prefetchSegment(ID, key, index);
    expect(heldSegmentsState().reading).toBe(4);
    expect(heldSegment(ID, "234", 0)).toBeNull();
  });

  it("au-delà de 32 Mo, les moins récemment servis partent ; au-delà de cinq minutes, plus rien", async () => {
    vi.stubGlobal("fetch", googlevideo({ size: 7 * MIB }));
    await prepareTrailer(ID);
    const segments: Array<[string, number]> = [["230", 0], ["230", 1], ["232", 0], ["232", 1], ["270", 0]];
    for (const [key, index] of segments) {
      prefetchSegment(ID, key, index);
      await heldSegment(ID, key, index);
    }
    // 5 × 7 Mo > 32 Mo : le plus ancien est parti, les quatre autres restent.
    expect(heldSegmentsState()).toMatchObject({ count: 4, bytes: 28 * MIB });
    expect(heldSegment(ID, "230", 0)).toBeNull();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    expect(heldSegment(ID, "270", 0)).toBeNull();
  });
});
