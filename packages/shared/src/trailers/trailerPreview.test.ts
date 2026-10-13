import { describe, expect, it } from "vitest";
import {
  TRAILER_PREVIEW_HLS_MIME, isTrailerPreview, parseTrailerPreviewQuery, previewItemIdOf, previewLangOf, previewTmdbIdOf,
  trailerPreviewPath,
} from "./trailerPreview";

const ITEM = "0123456789abcdef0123456789abcdef";
const DASHED = "01234567-89AB-CDEF-0123-456789ABCDEF";

describe("aperçu de bande-annonce › le chemin de la demande", () => {
  it("un titre de la bibliothèque, sous sa forme courte, avec la langue principale", () => {
    expect(trailerPreviewPath({ itemId: ITEM, lang: "fr" })).toBe(`/api/trailers/preview?itemId=${ITEM}&lang=fr`);
    expect(trailerPreviewPath({ itemId: DASHED, lang: "fr-CA" })).toBe(`/api/trailers/preview?itemId=${ITEM}&lang=fr`);
    expect(trailerPreviewPath({ itemId: ITEM })).toBe(`/api/trailers/preview?itemId=${ITEM}`);
  });

  it("un titre TMDB : son identifiant (nombre ou texte) et son type", () => {
    expect(trailerPreviewPath({ tmdbId: 438631, mediaType: "movie", lang: "en" }))
      .toBe("/api/trailers/preview?tmdbId=438631&mediaType=movie&lang=en");
    expect(trailerPreviewPath({ tmdbId: "1396", mediaType: "tv" })).toBe("/api/trailers/preview?tmdbId=1396&mediaType=tv");
  });

  it("une demande illisible ne donne rien à demander ; une langue illisible est omise", () => {
    expect(trailerPreviewPath({ itemId: "../../etc" })).toBeNull();
    expect(trailerPreviewPath({ tmdbId: 0, mediaType: "movie" })).toBeNull();
    expect(trailerPreviewPath({ tmdbId: "12a", mediaType: "movie" })).toBeNull();
    expect(trailerPreviewPath({ tmdbId: 12, mediaType: "person" as never })).toBeNull();
    expect(trailerPreviewPath({ itemId: ITEM, lang: "fr;drop" })).toBe(`/api/trailers/preview?itemId=${ITEM}`);
  });
});

describe("aperçu de bande-annonce › la lecture de la requête (serveur)", () => {
  it("relit exactement ce que le chemin écrit", () => {
    for (const request of [
      { itemId: ITEM, lang: "fr" },
      { tmdbId: 693134, mediaType: "movie" as const, lang: "fr" },
      { tmdbId: 1396, mediaType: "tv" as const },
    ]) {
      const path = trailerPreviewPath(request)!;
      const query = Object.fromEntries(new URLSearchParams(path.split("?")[1]));
      expect(parseTrailerPreviewQuery(query)).toEqual(request);
    }
  });

  it("refuse l'absence de titre, deux titres à la fois, un paramètre répété", () => {
    expect(parseTrailerPreviewQuery({})).toBeNull();
    expect(parseTrailerPreviewQuery({ lang: "fr" })).toBeNull();
    expect(parseTrailerPreviewQuery({ tmdbId: "12" })).toBeNull();
    expect(parseTrailerPreviewQuery({ itemId: ITEM, tmdbId: "12", mediaType: "movie" })).toBeNull();
    expect(parseTrailerPreviewQuery({ itemId: [ITEM, ITEM] })).toBeNull();
    expect(parseTrailerPreviewQuery({ itemId: "zz" })).toBeNull();
  });

  it("normalise identifiants et langue", () => {
    expect(previewItemIdOf(DASHED)).toBe(ITEM);
    expect(previewTmdbIdOf("042")).toBeNull();
    expect(previewTmdbIdOf(157336)).toBe(157336);
    expect(previewLangOf("EN_us")).toBe("en");
    expect(previewLangOf(3)).toBeUndefined();
  });
});

describe("aperçu de bande-annonce › la réponse", () => {
  const preview = {
    ytId: "Way9Dexny3w", path: "/api/trailers/hls/Way9Dexny3w/master.m3u8?t=x.y", mimeType: TRAILER_PREVIEW_HLS_MIME,
    expiresAt: Date.now() + 3600_000, heights: [1080, 720], qualities: [],
  };

  it("se reconnaît, et un champ manquant ou étranger vaut « rien à montrer »", () => {
    expect(isTrailerPreview(preview)).toBe(true);
    expect(isTrailerPreview({ ...preview, path: "https://youtube.com/watch?v=Way9Dexny3w" })).toBe(false);
    expect(isTrailerPreview({ ...preview, mimeType: "text/html" })).toBe(false);
    expect(isTrailerPreview({ error: "no_trailer" })).toBe(false);
    expect(isTrailerPreview(null)).toBe(false);
  });
});
