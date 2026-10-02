import { describe, expect, it } from "vitest";
import { itagOf, parseMaster, renderMaster, rewriteMedia, startVariant } from "./hlsPlaylists";

const GV = "https://manifest.googlevideo.test/api/manifest/hls_playlist/expire/1790970374/ip/203.0.113.7";
const BASE = "https://manifest.googlevideo.test/api/manifest/hls_variant/expire/1790970374/ip/203.0.113.7/file/index.m3u8";

/**
 * Le maître du client `visionos` tel que relevé le 2026-10-02 (Dune, deuxième
 * partie), abrégé : variantes vidéo seules, H.264 puis VP9, deux groupes audio
 * et des sous-titres.
 */
const VISIONOS_MASTER = [
  "#EXTM3U",
  "#EXT-X-INDEPENDENT-SEGMENTS",
  `#EXT-X-MEDIA:URI="${GV}/itag/233/index.m3u8",TYPE=AUDIO,GROUP-ID="233",NAME="Default",DEFAULT=YES,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/itag/234/index.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES,AUTOSELECT=YES`,
  `#EXT-X-MEDIA:URI="${GV}/sub/en/index.m3u8",TYPE=SUBTITLES,GROUP-ID="vtt",LANGUAGE="en-US",NAME="English",DEFAULT=NO,AUTOSELECT=YES`,
  '#EXT-X-STREAM-INF:BANDWIDTH=198356,CODECS="avc1.4D4015,mp4a.40.5",RESOLUTION=426x240,FRAME-RATE=24,AUDIO="233",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/229/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=24,AUDIO="234",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/232/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=3295980,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=24,AUDIO="234",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/270/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=2283500,CODECS="vp09.00.40.08,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=24,AUDIO="234",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
  `${GV}/itag/614/index.m3u8`,
  "",
].join("\n");

/** Le maître muxé des clients web (formats 91 à 96) : pas de groupe audio. */
const MUXED_MASTER = [
  "#EXTM3U",
  '#EXT-X-STREAM-INF:BANDWIDTH=290035,CODECS="avc1.4D400C,mp4a.40.5",RESOLUTION=256x144',
  `${GV}/itag/91/index.m3u8`,
  '#EXT-X-STREAM-INF:BANDWIDTH=4686021,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080',
  `${GV}/itag/96/index.m3u8`,
].join("\n");

describe("parseMaster", () => {
  it("ne garde que le H.264, et l'audio qu'il référence", () => {
    const master = parseMaster(VISIONOS_MASTER, BASE)!;
    expect(master.variants.map((v) => v.key)).toEqual(["229", "232", "270"]);
    expect(master.audio.map((a) => a.key)).toEqual(["233", "234"]);
    expect(master.header).toEqual(["#EXT-X-INDEPENDENT-SEGMENTS"]);
  });

  it("retire les sous-titres de YouTube", () => {
    const text = renderMaster(parseMaster(VISIONOS_MASTER, BASE)!, (key) => `p/${key}.m3u8`);
    expect(text).not.toContain("SUBTITLES");
    expect(text).not.toContain("vtt");
  });

  it("lit un maître muxé, sans groupe audio", () => {
    const master = parseMaster(MUXED_MASTER, BASE)!;
    expect(master.variants.map((v) => v.key)).toEqual(["91", "96"]);
    expect(master.audio).toEqual([]);
  });

  it("refuse ce qui n'est pas un maître, ou un maître sans H.264", () => {
    expect(parseMaster("<html>403</html>", BASE)).toBeNull();
    expect(parseMaster("#EXTM3U\n#EXTINF:4,\nseg.ts\n", BASE)).toBeNull();
    const vp9Only = ["#EXTM3U", '#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS="vp09.00.40.08",RESOLUTION=1920x1080', "v.m3u8"].join("\n");
    expect(parseMaster(vp9Only, BASE)).toBeNull();
  });

  it("résout une URI relative contre la liste amont", () => {
    const master = parseMaster(["#EXTM3U", '#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1280x720', "itag/22/v.m3u8"].join("\n"), BASE)!;
    expect(master.variants[0].upstream).toBe(new URL("itag/22/v.m3u8", BASE).href);
  });
});

describe("renderMaster", () => {
  it("met la 720p en tête — AVPlayer part de la première variante", () => {
    const text = renderMaster(parseMaster(VISIONOS_MASTER, BASE)!, (key) => `p/${key}.m3u8`);
    const uris = text.split("\n").filter((l) => l.startsWith("p/"));
    expect(uris).toEqual(["p/232.m3u8", "p/229.m3u8", "p/270.m3u8"]);
    expect(text).toContain('URI="p/233.m3u8"');
    expect(text).not.toContain("googlevideo");
  });

  it("part de la plus basse quand rien ne tient sous la 720p", () => {
    const master = parseMaster(MUXED_MASTER.replace("256x144", "1920x1080"), BASE)!;
    expect(startVariant(master.variants).key).toBe("91");
  });
});

describe("rewriteMedia", () => {
  const MEDIA = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-TARGETDURATION:8",
    "#EXTINF:4.129125,",
    "https://rr3.googlevideo.test/videoplayback/itag/270/sq/0/file/seg.ts",
    "#EXTINF:6.965291,",
    "https://rr3.googlevideo.test/videoplayback/itag/270/sq/1/file/seg.ts",
    "#EXT-X-ENDLIST",
  ].join("\n");

  it("pointe chaque segment vers le relais, dans l'ordre", () => {
    const media = rewriteMedia(MEDIA, BASE, (i) => `../s/270/${i}.ts`, () => "../s/270/init.mp4")!;
    expect(media.segments).toHaveLength(2);
    expect(media.segments[1]).toContain("/sq/1/");
    expect(media.text).toContain("../s/270/0.ts");
    expect(media.text).toContain("../s/270/1.ts");
    expect(media.text).toContain("#EXT-X-ENDLIST");
    expect(media.text).not.toContain("googlevideo");
  });

  it("relaie le segment d'initialisation d'un flux fMP4", () => {
    const fmp4 = MEDIA.replace("#EXT-X-TARGETDURATION:8", '#EXT-X-TARGETDURATION:8\n#EXT-X-MAP:URI="init.mp4"');
    const media = rewriteMedia(fmp4, BASE, (i) => `s/${i}`, () => "s/init")!;
    expect(media.init).toBe(new URL("init.mp4", BASE).href);
    expect(media.text).toContain('#EXT-X-MAP:URI="s/init"');
  });

  it("refuse un maître ou une page d'erreur", () => {
    expect(rewriteMedia(MUXED_MASTER, BASE, String, () => "")).toBeNull();
    expect(rewriteMedia("Forbidden", BASE, String, () => "")).toBeNull();
  });
});

describe("itagOf", () => {
  it("lit l'itag d'un chemin googlevideo ou d'une requête", () => {
    expect(itagOf(`${GV}/itag/270/index.m3u8`)).toBe("270");
    expect(itagOf("https://rr1.googlevideo.test/videoplayback?expire=1&itag=18&ip=1")).toBe("18");
    expect(itagOf("https://example.test/x.m3u8")).toBeUndefined();
  });
});
