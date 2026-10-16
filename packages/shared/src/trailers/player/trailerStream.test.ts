import { describe, expect, it } from "vitest";
import { parseTrailerResolve, trailerQualityUrl, trailerSubtitleUrl } from "./trailerStream";

const SERVER = "http://192.168.1.10:3000";
const ID = "Way9Dexny3w";
const T = "lx3k9a.AbC_d-e";

/** La réponse d'un serveur qui déclare `trailers.player`. */
const PLAYER = {
  url: `http://autre.test${`/api/trailers/hls/${ID}/master.m3u8?t=${T}`}`,
  path: `/api/trailers/hls/${ID}/master.m3u8?t=${T}`,
  mimeType: "application/vnd.apple.mpegurl",
  expiresAt: 1791747389000,
  qualities: [
    { height: 720, path: `/api/trailers/hls/${ID}/master-720.m3u8?t=${T}` },
    { height: 1080, path: `/api/trailers/hls/${ID}/master-1080.m3u8?t=${T}` },
  ],
  subtitles: [
    { lang: "fr", label: "French", auto: true, path: `/api/trailers/subs/${ID}/a-fr.vtt?t=${T}` },
    { lang: "en-US", label: "English (United States)", auto: false, path: `/api/trailers/subs/${ID}/m-en-US.vtt?t=${T}` },
  ],
};

describe("parseTrailerResolve", () => {
  it("lit le flux derrière l'adresse que la TV connaît, ses qualités (de la plus haute) et ses pistes", () => {
    const stream = parseTrailerResolve(PLAYER, SERVER)!;
    expect(stream.url).toBe(`${SERVER}${PLAYER.path}`);
    expect(stream.type).toBe("m3u8");
    expect(stream.qualities.map((q) => q.height)).toEqual([1080, 720]);
    expect(stream.subtitles.map((s) => [s.lang, s.auto])).toEqual([["fr", true], ["en-US", false]]);
  });

  it("serveur d'avant `trailers.player` : le flux seul, listes vides, sans erreur", () => {
    const stream = parseTrailerResolve({ path: PLAYER.path, mimeType: PLAYER.mimeType }, SERVER)!;
    expect(stream).toEqual({ url: `${SERVER}${PLAYER.path}`, type: "m3u8", qualities: [], subtitles: [] });
    // Plus ancien encore : l'URL absolue, un MP4.
    expect(parseTrailerResolve({ url: "https://rr.test/v.mp4", mimeType: "video/mp4" }, SERVER)).toEqual({
      url: "https://rr.test/v.mp4", type: undefined, qualities: [], subtitles: [],
    });
  });

  it("écarte ce qui n'est pas relayé par ce serveur, les doublons et l'illisible", () => {
    const stream = parseTrailerResolve({
      path: PLAYER.path,
      qualities: [{ height: 720, path: "https://googlevideo.test/x.m3u8" }, { height: "1080", path: PLAYER.qualities[1].path }, PLAYER.qualities[0], PLAYER.qualities[0]],
      subtitles: [{ lang: "../x", path: PLAYER.subtitles[0].path }, { lang: "fr", path: "//evil.test/a.vtt" }, PLAYER.subtitles[0], { ...PLAYER.subtitles[0], label: "" }],
    }, SERVER)!;
    expect(stream.qualities).toEqual([PLAYER.qualities[0]]);
    expect(stream.subtitles).toEqual([PLAYER.subtitles[0]]);
  });

  it("lit la piste audio jouée (doublage par IA retiré par le serveur), et ignore une piste illisible", () => {
    expect(parseTrailerResolve({ ...PLAYER, audio: { content: "original", lang: "en-US" } }, SERVER)!.audio).toEqual({ content: "original", lang: "en-US" });
    expect(parseTrailerResolve({ ...PLAYER, audio: { content: "dubbed-auto", lang: "fr" } }, SERVER)!.audio).toBeUndefined();
    expect(parseTrailerResolve({ ...PLAYER, audio: { content: "original", lang: "<script>" } }, SERVER)!.audio).toBeUndefined();
    expect(parseTrailerResolve(PLAYER, SERVER)).not.toHaveProperty("audio");
  });

  it("sans flux lisible : null", () => {
    expect(parseTrailerResolve(null, SERVER)).toBeNull();
    expect(parseTrailerResolve({ mimeType: "video/mp4" }, SERVER)).toBeNull();
    expect(parseTrailerResolve({ url: "ftp://x" }, SERVER)).toBeNull();
  });
});

describe("trailerQualityUrl / trailerSubtitleUrl", () => {
  const stream = parseTrailerResolve(PLAYER, SERVER)!;

  it("une hauteur offerte → son maître réduit ; Auto ou hauteur inconnue → le maître entier", () => {
    expect(trailerQualityUrl(stream, SERVER, 720)).toBe(`${SERVER}${PLAYER.qualities[0].path}`);
    expect(trailerQualityUrl(stream, SERVER, null)).toBe(stream.url);
    expect(trailerQualityUrl(stream, SERVER, 480)).toBe(stream.url);
  });

  it("une langue offerte → son WebVTT ; aucune ou inconnue → null", () => {
    expect(trailerSubtitleUrl(stream, SERVER, "en-US")).toBe(`${SERVER}${PLAYER.subtitles[1].path}`);
    expect(trailerSubtitleUrl(stream, SERVER, null)).toBeNull();
    expect(trailerSubtitleUrl(stream, SERVER, "de")).toBeNull();
  });
});
