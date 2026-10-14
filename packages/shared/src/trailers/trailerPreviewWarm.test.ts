import { describe, expect, it } from "vitest";
import { TRAILER_PREVIEW_HLS_MIME, type TrailerPreview } from "./trailerPreview";
import {
  TRAILER_PREVIEW_WARM_MAX_SUBJECTS, parseTrailerPreviewWarmBody, readTrailerPreviewWarmResponse, trailerPreviewWarmKey,
} from "./trailerPreviewWarm";

const ITEM = "0123456789abcdef0123456789abcdef";
const DASHED = "01234567-89AB-CDEF-0123-456789ABCDEF";

const preview: TrailerPreview = {
  ytId: "aaaaaaaaaaa", path: "/api/trailers/hls/aaaaaaaaaaa/master.m3u8?t=x", mimeType: TRAILER_PREVIEW_HLS_MIME,
  expiresAt: 2_000_000_000_000, heights: [720], qualities: [],
};

describe("préparation des aperçus › la lecture du corps (serveur)", () => {
  it("normalise les titres, écarte les illisibles et les doublons", () => {
    const parsed = parseTrailerPreviewWarmBody({
      lang: "fr-FR",
      dailymotion: true,
      subjects: [
        { itemId: DASHED }, { itemId: ITEM }, { tmdbId: "603", mediaType: "movie" }, { tmdbId: 603, mediaType: "movie" },
        { tmdbId: 1396, mediaType: "tv" }, { itemId: "../../etc" }, { tmdbId: 12, mediaType: "person" }, { itemId: ITEM, tmdbId: 1 }, null, "x",
      ],
    });
    expect(parsed).toEqual({
      subjects: [{ itemId: ITEM }, { tmdbId: 603, mediaType: "movie" }, { tmdbId: 1396, mediaType: "tv" }],
      lang: "fr",
      dailymotion: true,
    });
  });

  it("40 titres au plus ; sans titre lisible, rien à préparer", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ tmdbId: i + 1, mediaType: "movie" }));
    expect(parseTrailerPreviewWarmBody({ subjects: many })?.subjects).toHaveLength(TRAILER_PREVIEW_WARM_MAX_SUBJECTS);
    expect(parseTrailerPreviewWarmBody({ subjects: [{ itemId: "nope" }] })).toBeNull();
    expect(parseTrailerPreviewWarmBody({ subjects: "x" })).toBeNull();
    expect(parseTrailerPreviewWarmBody([])).toBeNull();
    expect(parseTrailerPreviewWarmBody(null)).toBeNull();
  });

  it("le Dailymotion ne vaut que `true`, la langue illisible est omise", () => {
    expect(parseTrailerPreviewWarmBody({ subjects: [{ itemId: ITEM }], dailymotion: "1", lang: "fr;drop" })).toEqual({ subjects: [{ itemId: ITEM }] });
  });
});

describe("préparation des aperçus › la réponse (client)", () => {
  it("garde les aperçus lisibles, ignore le reste", () => {
    const read = readTrailerPreviewWarmResponse({
      ready: [
        { subject: { tmdbId: 603, mediaType: "movie" }, preview },
        { subject: { tmdbId: 604, mediaType: "movie" }, preview: { ...preview, path: "https://ailleurs/x" } },
        { subject: { itemId: "nope" }, preview },
        null,
      ],
      queued: 3,
    });
    expect(read).toEqual({ ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview }], queued: 3 });
    expect(readTrailerPreviewWarmResponse({ ready: "x" })).toBeNull();
    expect(readTrailerPreviewWarmResponse({ ready: [] })).toEqual({ ready: [], queued: 0 });
  });

  it("la clé d'un titre est celle des sujets du client", () => {
    expect(trailerPreviewWarmKey({ itemId: ITEM })).toBe(`item:${ITEM}`);
    expect(trailerPreviewWarmKey({ tmdbId: 603, mediaType: "movie" })).toBe("tmdb:movie:603");
  });
});
