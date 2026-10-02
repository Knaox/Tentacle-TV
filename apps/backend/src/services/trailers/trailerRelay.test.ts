import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "./ytExtract";
import { TOKEN_SLOT, isReadable, masterTemplate, mediaTemplate, prepareTrailer, resetTrailerRelay, resolveTrailer, segmentTarget } from "./trailerRelay";

const { extractTrailerSource } = vi.hoisted(() => ({ extractTrailerSource: vi.fn<(ytId: string) => Promise<ExtractionResult>>() }));
vi.mock("./ytExtract", () => ({ extractTrailerSource }));
// Le relais lit googlevideo par le `fetch` du paquet undici : renvoyé ici vers le global, que chaque test remplace.
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));

const MIB = 1024 * 1024;
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const masterUrl = (generation: number) => `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/gen/${generation}/file/index.m3u8`;

const hls = (generation = 1): ExtractionResult => ({
  ok: true,
  clients: ["visionos"],
  source: { kind: "hls", masterUrl: masterUrl(generation), headers: {}, expiresAt: FUTURE * 1000 },
});

/** Un googlevideo factice : un maître (720p + 1080p, audio à part), leurs listes, des segments. */
function googlevideo(generation = 1) {
  const gv = `https://manifest.googlevideo.test/gen/${generation}`;
  const pages: Record<string, string> = {
    [masterUrl(generation)]: [
      "#EXTM3U",
      `#EXT-X-MEDIA:URI="${gv}/itag/234/a.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES`,
      '#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"',
      `${gv}/itag/232/v.m3u8`,
      '#EXT-X-STREAM-INF:BANDWIDTH=3295980,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,AUDIO="234"',
      `${gv}/itag/270/v.m3u8`,
    ].join("\n"),
  };
  for (const itag of ["232", "270", "234"]) {
    pages[`${gv}/itag/${itag}/${itag === "234" ? "a" : "v"}.m3u8`] =
      `#EXTM3U\n#EXT-X-TARGETDURATION:8\n#EXTINF:4,\n${gv}/seg/${itag}/0.ts\n#EXTINF:4,\n${gv}/seg/${itag}/1.ts\n#EXT-X-ENDLIST\n`;
  }
  return vi.fn(async (url: string) => (url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 })));
}

beforeEach(() => {
  resetTrailerRelay();
  extractTrailerSource.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("résolution", () => {
  it("partage une extraction entre deux demandes simultanées, puis la garde", async () => {
    extractTrailerSource.mockImplementation(async () => hls());
    const [a, b] = await Promise.all([resolveTrailer("Way9Dexny3w"), resolveTrailer("Way9Dexny3w")]);
    expect(a?.kind).toBe("hls");
    expect(b).toEqual(a);
    await resolveTrailer("Way9Dexny3w");
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
  });

  it("retient un échec un instant, sans relancer yt-dlp dans la rafale", async () => {
    extractTrailerSource.mockResolvedValue({ ok: false, permanent: false, timedOut: false, reason: "0 formats" });
    expect(await resolveTrailer("Way9Dexny3w")).toBeNull();
    expect(await resolveTrailer("Way9Dexny3w")).toBeNull();
    expect(extractTrailerSource).toHaveBeenCalledTimes(1);
  });

  it("ne retient pas un délai épuisé : le geste suivant réessaie", async () => {
    extractTrailerSource.mockResolvedValueOnce({ ok: false, permanent: false, timedOut: true, reason: "sans réponse" }).mockResolvedValueOnce(hls());
    expect(await resolveTrailer("Way9Dexny3w")).toBeNull();
    expect((await resolveTrailer("Way9Dexny3w"))?.kind).toBe("hls");
  });
});

describe("listes relayées", () => {
  it("sert un maître sans aucune URL googlevideo, le jeton à sa place", async () => {
    extractTrailerSource.mockResolvedValue(hls());
    vi.stubGlobal("fetch", googlevideo());
    const master = (await masterTemplate("Way9Dexny3w"))!;
    expect(master).not.toContain("googlevideo");
    expect(master).toContain(`p/232.m3u8?t=${TOKEN_SLOT}`);
    expect(master.indexOf("p/232.m3u8")).toBeLessThan(master.indexOf("p/270.m3u8"));
    const media = (await mediaTemplate("Way9Dexny3w", "270"))!;
    expect(media).toContain(`../s/270/1.ts?t=${TOKEN_SLOT}`);
    expect((await segmentTarget("Way9Dexny3w", "270", 1))?.url).toContain("/seg/270/1.ts");
  });

  it("partage une lecture amont entre deux demandes de la même liste", async () => {
    extractTrailerSource.mockResolvedValue(hls());
    const fetch = googlevideo();
    vi.stubGlobal("fetch", fetch);
    await resolveTrailer("Way9Dexny3w");
    await Promise.all([masterTemplate("Way9Dexny3w"), masterTemplate("Way9Dexny3w"), mediaTemplate("Way9Dexny3w", "270"), mediaTemplate("Way9Dexny3w", "270")]);
    const asked = fetch.mock.calls.map(([url]) => String(url));
    expect(asked.filter((u) => u.endsWith("/index.m3u8"))).toHaveLength(1);
    expect(asked.filter((u) => u.includes("/itag/270/"))).toHaveLength(1);
  });

  it("prépare le maître et les listes de départ (vidéo 720p et son audio)", async () => {
    extractTrailerSource.mockResolvedValue(hls());
    const fetch = googlevideo();
    vi.stubGlobal("fetch", fetch);
    await prepareTrailer("Way9Dexny3w");
    const asked = fetch.mock.calls.map(([url]) => String(url));
    expect(asked.some((u) => u.includes("/itag/232/"))).toBe(true);
    expect(asked.some((u) => u.includes("/itag/234/"))).toBe(true);
    expect(asked.some((u) => u.includes("/itag/270/"))).toBe(false);
  });

  it("réextrait une fois quand googlevideo ne sert plus le maître", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    extractTrailerSource.mockResolvedValueOnce(hls(1)).mockResolvedValueOnce(hls(2));
    vi.stubGlobal("fetch", googlevideo(2));
    await resolveTrailer("Way9Dexny3w");
    vi.setSystemTime(Date.now() + 2 * 60_000);
    expect(await masterTemplate("Way9Dexny3w")).toContain("p/232.m3u8");
    expect(extractTrailerSource).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

/**
 * Un googlevideo qui ne sert que le début du fichier : le format 18 refusé,
 * tel que mesuré le 2026-10-01 (client ANDROID_VR) — une plage qui commence à
 * 0 et tient dans le premier mégaoctet passe, tout le reste répond 403.
 */
function firstMebibyteOnly(size: number) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const m = /^bytes=(\d+)-(\d*)$/.exec(new Headers(init?.headers).get("range") ?? "");
    const end = m?.[2] ? Number(m[2]) : size - 1;
    if (!m || Number(m[1]) !== 0 || end >= MIB) return new Response(null, { status: 403 });
    return new Response(new Uint8Array(end + 1), { status: 206 });
  });
}

describe("isReadable", () => {
  it("refuse un flux que YouTube coupe après son premier mégaoctet", async () => {
    vi.stubGlobal("fetch", firstMebibyteOnly(8_221_698));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(false);
  });

  it("accepte un flux servi en entier", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(16), { status: 206 })));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(true);
  });

  it("refuse un flux injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(false);
  });
});
