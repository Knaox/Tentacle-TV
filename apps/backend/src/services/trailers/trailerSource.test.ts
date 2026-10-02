import { describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_PASSES, clientPasses, isPermanentFailure, parseExpiry, pickTrailerSource, type YtFormat } from "./trailerSource";

const NOW = 1_790_000_000_000;
const MASTER = "https://manifest.googlevideo.test/api/manifest/hls_variant/expire/1790970374/ip/203.0.113.7/file/index.m3u8";
const UA = { "User-Agent": "Mozilla/5.0 test" };

/** Les formats du client `visionos` (relevé du 2026-10-02) : HLS vidéo seule, audio à part, aucun muxé. */
const VISIONOS: YtFormat[] = [
  { format_id: "140", protocol: "https", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", url: "https://rr.test/140" },
  { format_id: "233", protocol: "m3u8_native", ext: "mp4", vcodec: "none", acodec: null, manifest_url: MASTER, url: "https://m.test/233" },
  { format_id: "232", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.4D401F", acodec: "none", height: 720, manifest_url: MASTER, url: "https://m.test/232", http_headers: UA },
  { format_id: "270", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.640028", acodec: "none", height: 1080, manifest_url: MASTER, url: "https://m.test/270", http_headers: UA },
  { format_id: "614", protocol: "m3u8_native", ext: "mp4", vcodec: "vp09.00.40.08", acodec: "none", height: 1080, manifest_url: MASTER, url: "https://m.test/614" },
  { format_id: "137", protocol: "https", ext: "mp4", vcodec: "avc1.640028", acodec: "none", height: 1080, url: "https://rr.test/137" },
];

/** Une vidéo « pour enfants » avec le yt-dlp stable : rien que le format 18 (via web_embedded). */
const KIDS_STABLE: YtFormat[] = [
  { format_id: "18", protocol: "https", ext: "mp4", vcodec: "avc1.42001E", acodec: "mp4a.40.2", height: 360, url: "https://rr.test/videoplayback?expire=1790970374&itag=18", http_headers: UA },
  { format_id: "137", protocol: "https", ext: "mp4", vcodec: "avc1.640028", acodec: "none", height: 1080, url: "https://rr.test/137" },
];

describe("pickTrailerSource", () => {
  it("prend le maître HLS du client visionos, pas un format isolé", () => {
    const source = pickTrailerSource(VISIONOS, NOW);
    expect(source).toEqual({ kind: "hls", masterUrl: MASTER, headers: UA, expiresAt: 1790970374 * 1000 });
  });

  it("prend le maître muxé des clients web (91 à 96) avant le format 18", () => {
    const muxed: YtFormat[] = [
      ...KIDS_STABLE,
      { format_id: "96", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.640028", acodec: "mp4a.40.2", height: 1080, manifest_url: MASTER, url: "https://m.test/96" },
    ];
    expect(pickTrailerSource(muxed, NOW)?.kind).toBe("hls");
  });

  it("se replie sur le MP4 muxé H.264 + AAC quand il n'y a pas de HLS", () => {
    const source = pickTrailerSource(KIDS_STABLE, NOW);
    expect(source?.kind).toBe("progressive");
    expect(source && "url" in source && source.url).toContain("itag=18");
  });

  it("ne rend rien sans flux lisible : images seules, VP9 seul, DRM", () => {
    expect(pickTrailerSource([], NOW)).toBeNull();
    expect(pickTrailerSource([{ format_id: "sb0", protocol: "mhtml", ext: "mhtml", vcodec: "none" }], NOW)).toBeNull();
    expect(pickTrailerSource(VISIONOS.filter((f) => !f.vcodec?.startsWith("avc1")), NOW)).toBeNull();
    expect(pickTrailerSource(VISIONOS.map((f) => ({ ...f, has_drm: true })), NOW)).toBeNull();
  });
});

describe("parseExpiry", () => {
  it("lit l'échéance d'un manifeste et d'un progressif, sinon cinq heures", () => {
    expect(parseExpiry(MASTER, NOW)).toBe(1790970374 * 1000);
    expect(parseExpiry("https://rr.test/videoplayback?expire=1790970000&itag=18", NOW)).toBe(1790970000 * 1000);
    expect(parseExpiry("https://example.test/v.m3u8", NOW)).toBe(NOW + 5 * 3600 * 1000);
  });
});

describe("clientPasses", () => {
  it("part de visionos, puis des clients par défaut de yt-dlp", () => {
    expect(clientPasses(undefined)).toEqual([["visionos"], ["default", "web_safari", "web_embedded"]]);
    expect(clientPasses("")).toEqual(clientPasses(DEFAULT_CLIENT_PASSES));
  });

  it("se règle par l'environnement, sans rien laisser passer d'autre qu'un nom", () => {
    expect(clientPasses("tv ; default,web_safari")).toEqual([["tv"], ["default", "web_safari"]]);
    expect(clientPasses("visionos;$(rm -rf /)")).toEqual([["visionos"]]);
  });
});

describe("isPermanentFailure", () => {
  it("distingue une vidéo retirée d'un bridage passager", () => {
    expect(isPermanentFailure("ERROR: [youtube] x: Private video. Sign in if you've been granted access")).toBe(true);
    expect(isPermanentFailure("ERROR: [youtube] x: Video unavailable. This video has been removed by the uploader")).toBe(true);
    expect(isPermanentFailure("ERROR: [youtube] x: Video unavailable. This content isn't available, try again later.")).toBe(false);
    expect(isPermanentFailure("ERROR: [youtube] x: Sign in to confirm you're not a bot.")).toBe(false);
    expect(isPermanentFailure("ERROR: unable to download webpage: timed out")).toBe(false);
  });
});
