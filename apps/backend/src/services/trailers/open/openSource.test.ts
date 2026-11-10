import { describe, expect, it } from "vitest";
import { parseMaster, renderMaster, OPUS_KEY } from "../hlsPlaylists";
import { pickTrailerSource, type YtFormat } from "../trailerSource";
import { chooseOpusTrack, pickOpenSource } from "./openSource";

/**
 * Les formats d'une bande-annonce tels que yt-dlp les rend (relevé du 2026-11-10, client
 * `visionos`, abrégé ; hôtes remplacés) : H.264 et VP9 dans le MÊME maître HLS, dont l'audio
 * n'est que de l'AAC ; l'Opus en WebM à part, avec ses variantes à dynamique compressée.
 */
const MASTER = "https://manifest.googlevideo.test/api/manifest/hls_variant/expire/1794343935/index.m3u8";
const gv = (itag: number, xtags = "") => `https://rr.googlevideo.test/videoplayback?expire=1794343935&itag=${itag}${xtags ? `&xtags=${encodeURIComponent(xtags)}` : ""}`;
const hlsFormat = (id: string, vcodec: string, height: number): YtFormat => ({ format_id: id, protocol: "m3u8_native", ext: "mp4", vcodec, acodec: "none", height, manifest_url: MASTER });
const opus = (id: string, tbr: number, itag: number, xtags = "", note = "medium"): YtFormat =>
  ({ format_id: id, protocol: "https", ext: "webm", vcodec: "none", acodec: "opus", tbr, url: gv(itag, xtags), format_note: note });
const FORMATS: YtFormat[] = [
  { format_id: "233", protocol: "m3u8_native", ext: "mp4", vcodec: "none", manifest_url: MASTER },
  opus("249-drc", 48, 249, "drc=1", "low, DRC"), opus("249", 48, 249, "", "low"), opus("250", 63, 250, "", "low"),
  opus("251-drc", 125, 251, "drc=1", "medium, DRC"), opus("251", 124, 251),
  { format_id: "140", protocol: "https", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", tbr: 130, url: gv(140) },
  hlsFormat("602", "vp09.00.10.08", 144), hlsFormat("269", "avc1.4D400C", 144),
  hlsFormat("605", "vp09.00.21.08", 360), hlsFormat("230", "avc1.4D401E", 360),
  hlsFormat("609", "vp09.00.31.08", 720), hlsFormat("232", "avc1.4D401F", 720),
  hlsFormat("614", "vp09.00.40.08", 1080), hlsFormat("270", "avc1.640028", 1080),
  { format_id: "248", protocol: "https", ext: "webm", vcodec: "vp9", acodec: "none", height: 1080, url: gv(248) },
];
const BOUNDS = { minHeight: 360, maxHeight: 1080 };

describe("le flux libre d'une extraction (openSource.ts)", () => {
  it("garde les hauteurs VP9 du maître et la piste Opus la plus riche, jamais une DRC", () => {
    const open = pickOpenSource(FORMATS, MASTER, BOUNDS);
    expect(open?.heights).toEqual([1080, 720, 360]);
    expect(open?.opus).toHaveLength(1);
    expect(open?.opus[0].bitrate).toBe(124);
    expect(open?.opus[0].url).toContain("itag=251");
    expect(open?.opus[0].url).not.toContain("drc");
  });

  it("n'existe pas sans VP9 dans le maître, ni sans Opus", () => {
    expect(pickOpenSource(FORMATS.filter((f) => !/^vp09/.test(f.vcodec ?? "")), MASTER, BOUNDS)).toBeUndefined();
    expect(pickOpenSource(FORMATS.filter((f) => f.acodec !== "opus"), MASTER, BOUNDS)).toBeUndefined();
    // Le VP9 d'un AUTRE maître, ou en fichier (DASH), ne compte pas : le relais sert des listes HLS.
    expect(pickOpenSource(FORMATS, "https://manifest.googlevideo.test/autre.m3u8", BOUNDS)).toBeUndefined();
  });

  it("la même extraction dit les deux flux : le H.264 de toujours, et le libre à côté", () => {
    const source = pickTrailerSource(FORMATS, Date.parse("2026-11-10T16:00:00Z"));
    expect(source?.kind).toBe("hls");
    if (source?.kind !== "hls") return;
    expect(source.heights).toEqual([1080, 720, 360]);
    expect(source.open?.heights).toEqual([1080, 720, 360]);
    expect(source.open?.opus[0].url).toContain("itag=251");
    // Une vidéo sans Opus (« pour enfants », MP4 seul) reste lisible en H.264, sans flux libre.
    const plain = pickTrailerSource(FORMATS.filter((f) => f.acodec !== "opus"), Date.now());
    expect(plain?.kind === "hls" && plain.open).toBeUndefined();
  });
});

describe("la piste Opus jouée (chooseOpusTrack) — la règle des doublages", () => {
  const dubbed: YtFormat[] = [
    ...FORMATS.filter((f) => f.acodec !== "opus"),
    opus("251-0", 128, 251, "acont=dubbed:lang=fr"), opus("250-0", 64, 250, "acont=dubbed:lang=fr"),
    opus("251-1", 127, 251, "acont=dubbed-auto:lang=de-DE"),
    opus("251-2", 129, 251, "acont=original:lang=en-US"),
    opus("251-3", 126, 251, "acont=descriptive:lang=en-US"),
  ];
  const open = pickOpenSource(dubbed, MASTER, BOUNDS);

  it("une piste par contenu et par langue, la plus riche — jamais la voix de synthèse ni l'audiodescription", () => {
    expect(open?.opus.map((track) => [track.tag.content, track.tag.lang, track.bitrate])).toEqual([
      ["dubbed", "fr", 128], ["original", "en-US", 129],
    ]);
  });

  it("un doublage HUMAIN dans la langue du serveur, sinon l'originale", () => {
    if (!open) throw new Error("open");
    expect(chooseOpusTrack(open, "fr")?.choice).toEqual({ content: "dubbed", lang: "fr" });
    expect(chooseOpusTrack(open, "fr-CA")?.track.url).toContain("dubbed");
    // Pas de doublage humain en allemand (le sien est automatique) : l'originale, quitte à jouer de la VO.
    const german = chooseOpusTrack(open, "de");
    expect(german?.choice).toEqual({ content: "original", lang: "en-US" });
    expect(german?.track.url).toContain("original");
    expect(chooseOpusTrack(open, null)?.choice).toEqual({ content: "original", lang: "en-US" });
  });

  it("une vidéo à une seule piste, sans marque : celle-là, sans rien en dire", () => {
    const single = pickOpenSource(FORMATS, MASTER, BOUNDS);
    if (!single) throw new Error("open");
    expect(chooseOpusTrack(single, "fr")).toEqual({ track: single.opus[0], choice: null });
  });

  it("rien, plutôt qu'une voix de synthèse : seule piste Opus, un doublage automatique", () => {
    const auto = pickOpenSource([...FORMATS.filter((f) => f.acodec !== "opus"), opus("251-1", 127, 251, "acont=dubbed-auto:lang=fr-FR")], MASTER, BOUNDS);
    expect(auto).toBeUndefined();
    // L'originale n'existe qu'en AAC (inventaire de l'extraction) et l'Opus n'offre qu'une autre langue : rien.
    const other = pickOpenSource([...FORMATS.filter((f) => f.acodec !== "opus"), opus("251-0", 128, 251, "acont=dubbed:lang=ja")], MASTER, BOUNDS);
    if (!other) throw new Error("open");
    expect(chooseOpusTrack(other, "fr", { original: "en-US", dubbed: ["ja"], autoDubbed: [] })).toBeNull();
  });
});

describe("le maître libre (parseMaster, `open`)", () => {
  const TEXT = [
    "#EXTM3U", "#EXT-X-INDEPENDENT-SEGMENTS",
    '#EXT-X-MEDIA:URI="https://m.googlevideo.test/itag/233/index.m3u8",TYPE=AUDIO,GROUP-ID="233",NAME="Default",DEFAULT=YES,AUTOSELECT=YES',
    '#EXT-X-MEDIA:URI="https://m.googlevideo.test/itag/234/index.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES,AUTOSELECT=YES',
    '#EXT-X-STREAM-INF:BANDWIDTH=518355,CODECS="vp09.00.21.08,mp4a.40.5",RESOLUTION=640x360,FRAME-RATE=24,AUDIO="233",SUBTITLES="vtt",CLOSED-CAPTIONS=NONE',
    "https://m.googlevideo.test/itag/605/index.m3u8",
    '#EXT-X-STREAM-INF:BANDWIDTH=420000,CODECS="avc1.4D401E,mp4a.40.5",RESOLUTION=640x360,FRAME-RATE=24,AUDIO="233",CLOSED-CAPTIONS=NONE',
    "https://m.googlevideo.test/itag/230/index.m3u8",
    '#EXT-X-STREAM-INF:BANDWIDTH=1006437,CODECS="vp09.00.31.08,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=24,AUDIO="234",CLOSED-CAPTIONS=NONE',
    "https://m.googlevideo.test/itag/609/index.m3u8",
    '#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=24,AUDIO="234",CLOSED-CAPTIONS=NONE',
    "https://m.googlevideo.test/itag/232/index.m3u8",
    '#EXT-X-STREAM-INF:BANDWIDTH=9000000,CODECS="vp09.00.50.08,mp4a.40.2",RESOLUTION=3840x2160,AUDIO="234"',
    "https://m.googlevideo.test/itag/628/index.m3u8",
  ].join("\n");
  const BASE = "https://m.googlevideo.test/master.m3u8";

  it("ne garde que le VP9 (jusqu'à 1080p) et remplace l'AAC par la piste Opus du relais", () => {
    const master = parseMaster(TEXT, BASE, { serverLang: "fr" }, { audioChoice: null });
    expect(master?.variants.map((v) => [v.key, v.height, v.video, v.audioGroup])).toEqual([
      ["605", 360, "vp09.00.21.08", OPUS_KEY], ["609", 720, "vp09.00.31.08", OPUS_KEY],
    ]);
    expect(master?.audio.map((a) => [a.key, a.group])).toEqual([[OPUS_KEY, OPUS_KEY]]);
    const text = renderMaster(master!, (key) => `p/${key}.m3u8?t=T`);
    expect(text).toContain(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="opus",NAME="Opus",DEFAULT=YES,AUTOSELECT=YES,URI="p/opus.m3u8?t=T"`);
    expect(text).toContain('CODECS="vp09.00.31.08,opus"');
    expect(text).toContain('AUDIO="opus"');
    // Rien de ce que ce lecteur ne décode : ni H.264, ni AAC, ni l'adresse de googlevideo.
    expect(text).not.toMatch(/avc1|mp4a|googlevideo|SUBTITLES/);
    // La 720p en tête (le départ), comme le maître H.264.
    expect(text.split("\n").find((line) => line.startsWith("p/"))).toBe("p/609.m3u8?t=T");
    // Un maître réduit à une qualité garde sa piste audio.
    expect(renderMaster(master!, (key) => `p/${key}.m3u8`, 360)).toContain('URI="p/opus.m3u8"');
  });

  it("dit la piste jouée, et n'existe pas sans variante VP9", () => {
    expect(parseMaster(TEXT, BASE, {}, { audioChoice: { content: "dubbed", lang: "fr" } })?.audioChoice).toEqual({ content: "dubbed", lang: "fr" });
    expect(parseMaster(TEXT.replace(/vp09/g, "av01"), BASE, {}, { audioChoice: null })).toBeNull();
    // Le maître H.264 de toujours n'a pas bougé.
    const h264 = parseMaster(TEXT, BASE, { serverLang: "fr" });
    expect(h264?.variants.map((v) => v.key)).toEqual(["230", "232"]);
    expect(h264?.audio.map((a) => a.group)).toEqual(["233", "234"]);
  });
});
