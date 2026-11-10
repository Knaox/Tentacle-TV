import { describe, expect, it } from "vitest";
import {
  parseTrailerDecodes, probeTrailerDecodes, TRAILER_CODEC_PROBES, trailerDecodesParam, trailerDeliveryFor,
} from "./trailerCodecs";
import { parseTrailerPreviewQuery, trailerPreviewPath } from "./trailerPreview";
import { parseTrailerPreviewWarmBody } from "./trailerPreviewWarm";

const ITEM = "0123456789abcdef0123456789abcdef";
/** Ce que le bureau CEF répond (binaires publics, mesuré le 10/11/2026) : ni `avc1` ni `mp4a`. */
const cef = (mimeType: string) => !/avc1|mp4a/.test(mimeType);

describe("ce que le lecteur décode (trailerCodecs.ts)", () => {
  it("sonde les types que le relais sert vraiment", () => {
    expect(probeTrailerDecodes(() => true)).toEqual(["h264", "aac", "vp9", "opus"]);
    expect(probeTrailerDecodes(cef)).toEqual(["vp9", "opus"]);
    expect(probeTrailerDecodes(() => false)).toEqual([]);
    // Une sonde qui lève (pas de MediaSource) : rien n'est décodé, rien ne plante.
    expect(probeTrailerDecodes(() => { throw new Error("pas de MediaSource"); })).toEqual([]);
    expect(TRAILER_CODEC_PROBES.opus).toBe('audio/mp4; codecs="opus"');
  });

  it("LA règle : H.264 par défaut, le flux libre pour qui ne lit que le VP9 et l'Opus, sinon rien", () => {
    const withOpen = { openCodecs: true };
    expect(trailerDeliveryFor(null, withOpen)).toBe("h264");                       // un client d'avant, un téléviseur
    expect(trailerDeliveryFor(["h264", "aac", "vp9", "opus"], withOpen)).toBe("h264");
    expect(trailerDeliveryFor(["vp9", "opus"], withOpen)).toBe("open");
    expect(trailerDeliveryFor(["h264", "vp9", "opus"], withOpen)).toBe("open");     // H.264 sans AAC : muet
    expect(trailerDeliveryFor(["vp9"], withOpen)).toBeNull();
    expect(trailerDeliveryFor([], withOpen)).toBeNull();
    // Un serveur qui ne sait pas servir le flux libre : rien pour ce lecteur, jamais du H.264 illisible.
    expect(trailerDeliveryFor(["vp9", "opus"], { openCodecs: false })).toBeNull();
    expect(trailerDeliveryFor(null, { openCodecs: false })).toBe("h264");
  });

  it("un client qui lit le H.264 n'écrit RIEN : sa requête est celle d'avant", () => {
    expect(trailerDecodesParam(["h264", "aac", "vp9", "opus"])).toBeNull();
    expect(trailerDecodesParam(null)).toBeNull();
    expect(trailerDecodesParam(undefined)).toBeNull();
    expect(trailerDecodesParam(["opus", "vp9"])).toBe("vp9,opus");
    expect(trailerDecodesParam([])).toBe("");
    expect(trailerPreviewPath({ itemId: ITEM, lang: "fr", dailymotion: true, decodes: ["h264", "aac"] }))
      .toBe(`/api/trailers/preview?itemId=${ITEM}&lang=fr&dm=1`);
    expect(trailerPreviewPath({ itemId: ITEM, lang: "fr", decodes: ["vp9", "opus"] }))
      .toBe(`/api/trailers/preview?itemId=${ITEM}&lang=fr&dec=vp9,opus`);
  });

  it("le serveur relit la déclaration comme le client l'écrit", () => {
    expect(parseTrailerDecodes(undefined)).toBeNull();
    expect(parseTrailerDecodes("vp9,opus")).toEqual(["vp9", "opus"]);
    expect(parseTrailerDecodes(" OPUS , vp9 , hevc ")).toEqual(["vp9", "opus"]);
    expect(parseTrailerDecodes("")).toEqual([]);
    expect(parseTrailerDecodes(12)).toEqual([]);
    expect(parseTrailerPreviewQuery({ itemId: ITEM })).toEqual({ itemId: ITEM });
    expect(parseTrailerPreviewQuery({ itemId: ITEM, dec: "vp9,opus" })).toEqual({ itemId: ITEM, decodes: ["vp9", "opus"] });
    // Le paramètre deux fois : illisible — « ne décode rien », jamais le H.264 par défaut.
    expect(parseTrailerPreviewQuery({ itemId: ITEM, dec: ["vp9", "opus"] })).toEqual({ itemId: ITEM, decodes: [] });
    expect(parseTrailerPreviewQuery({ tmdbId: "603", mediaType: "movie", lang: "fr", dec: "" })).toEqual({ tmdbId: 603, mediaType: "movie", lang: "fr", decodes: [] });
  });

  it("la préparation porte la même déclaration", () => {
    const subjects = [{ itemId: ITEM }];
    expect(parseTrailerPreviewWarmBody({ subjects })).toEqual({ subjects });
    expect(parseTrailerPreviewWarmBody({ subjects, decodes: ["vp9", "opus"] })).toEqual({ subjects, decodes: ["vp9", "opus"] });
    expect(parseTrailerPreviewWarmBody({ subjects, decodes: "vp9" })).toEqual({ subjects, decodes: [] });
  });
});
