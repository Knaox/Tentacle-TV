import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT_PASSES, clientPasses, isPermanentFailure, parseExpiry, pickTrailerSource, youTubeBlock, type YtFormat,
} from "./trailerSource";

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
    expect(source).toEqual({ kind: "hls", masterUrl: MASTER, headers: UA, expiresAt: 1790970374 * 1000, heights: [1080, 720] });
  });

  it("offre les hauteurs H.264 de CE maître, de 360p à 1080p (ni VP9, ni format isolé, ni 144p)", () => {
    const formats: YtFormat[] = [
      ...VISIONOS,
      { format_id: "229", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.4D4015", acodec: "none", height: 240, manifest_url: MASTER },
      { format_id: "230", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.4D401E", acodec: "none", height: 360, manifest_url: MASTER },
      { format_id: "x", protocol: "m3u8_native", ext: "mp4", vcodec: "avc1.4D401E", acodec: "none", height: 480, manifest_url: `${MASTER}?autre` },
    ];
    const source = pickTrailerSource(formats, NOW);
    expect(source?.kind === "hls" && source.heights).toEqual([1080, 720, 360]);
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

  it("ne lit que les ERREURS : un avertissement n'en fait pas une vidéo retirée", () => {
    expect(isPermanentFailure("WARNING: [youtube] x: Private video. Sign in if you've been granted access")).toBe(false);
  });
});

/**
 * Sorties de yt-dlp SIMULÉES (formes relevées dans son code et ses tickets) :
 * avec `--ignore-no-formats-error`, la raison de YouTube arrive en
 * AVERTISSEMENT quand aucun format ne vient.
 */
describe("youTubeBlock", () => {
  it("la vérification anti-robot, en erreur comme en avertissement, apostrophe droite ou courbe", () => {
    expect(youTubeBlock("ERROR: [youtube] dQw4w9WgXcQ: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.")).toBe("bot");
    expect(youTubeBlock("WARNING: [youtube] dQw4w9WgXcQ: Sign in to confirm you're not a bot. This helps protect our community. Learn more")).toBe("bot");
    expect(youTubeBlock("WARNING: [youtube] x: Sign in to confirm you’re not a bot. YouTube is requiring a captcha challenge before playback")).toBe("bot");
  });

  it("la limite de débit : 429, session bridée, « try again later », trafic inhabituel", () => {
    expect(youTubeBlock("ERROR: [youtube] x: Unable to download API page: HTTP Error 429: Too Many Requests")).toBe("limit");
    expect(youTubeBlock("WARNING: [youtube] The current session has been rate-limited by YouTube for up to an hour. It is recommended to use `-t sleep`")).toBe("limit");
    expect(youTubeBlock("WARNING: [youtube] x: Video unavailable. This content isn't available, try again later.")).toBe("limit");
    expect(youTubeBlock("ERROR: [youtube] x: Our systems have detected unusual traffic from your computer network")).toBe("limit");
  });

  it("jamais une vidéo qui manque, un âge à confirmer, ni ce qui n'est pas une ligne de yt-dlp", () => {
    for (const stderr of [
      "ERROR: [youtube] x: Video unavailable. This video has been removed by the uploader",
      "WARNING: [youtube] x: Private video. Sign in if you've been granted access to this video",
      "ERROR: [youtube] x: Sign in to confirm your age. This video may be inappropriate for some users.",
      "ERROR: [youtube] x: Requested format is not available",
      "WARNING: [youtube] Some web client https formats have been skipped as they are missing a url",
      "",
      "Command failed: yt-dlp … not a bot",
    ]) expect(youTubeBlock(stderr)).toBeNull();
  });
});
