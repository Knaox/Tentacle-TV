import { describe, expect, it } from "vitest";
import type { MediaItem } from "../../types/media";
import {
  trailerPreviewSubjectKey,
  trailerPreviewSubjectOfItem,
  trailerPreviewSubjectOfTitle,
  trailerPreviewSubjectPath,
} from "./previewSubject";

const MOVIE = "90d50b74d48412cfc9db9a256b1d0c64";
const SERIES = "3aaf1d2f2002de846ae4fd70d27aff80";

const item = (over: Partial<MediaItem>): MediaItem => ({ Id: MOVIE, Name: "x", Type: "Movie", ...over }) as MediaItem;

/** De quoi une carte montre la bande-annonce : le titre lui-même, ou rien. */
describe("le sujet d'un aperçu", () => {
  it("un film, une série : eux-mêmes", () => {
    expect(trailerPreviewSubjectOfItem(item({}))).toEqual({ kind: "item", itemId: MOVIE });
    expect(trailerPreviewSubjectOfItem(item({ Id: SERIES, Type: "Series" }))).toEqual({ kind: "item", itemId: SERIES });
  });

  it("un épisode, une saison : eux-mêmes (le serveur suit leur saison)", () => {
    // Un épisode, une saison : PAR EUX-MÊMES — leur saison d'abord, comme le bouton et les extras de leur fiche.
    expect(trailerPreviewSubjectOfItem(item({ Id: "e1", Type: "Episode", SeriesId: SERIES }))).toEqual({ kind: "item", itemId: "e1" });
    expect(trailerPreviewSubjectOfItem(item({ Id: "s1", Type: "Season", SeriesId: SERIES }))).toEqual({ kind: "item", itemId: "s1" });
    expect(trailerPreviewSubjectOfItem(item({ Id: "e1", Type: "Episode" }))).toEqual({ kind: "item", itemId: "e1" });
  });

  it("une collection, de la musique, rien : pas d'aperçu", () => {
    expect(trailerPreviewSubjectOfItem(item({ Type: "BoxSet" }))).toBeNull();
    expect(trailerPreviewSubjectOfItem(item({ Type: "MusicAlbum" }))).toBeNull();
    expect(trailerPreviewSubjectOfItem(null)).toBeNull();
    expect(trailerPreviewSubjectOfItem(undefined)).toBeNull();
  });

  it("le visage d'un titre hors bibliothèque vaut son identité TMDB", () => {
    expect(trailerPreviewSubjectOfItem(item({ Id: "ext:tv:1396", Type: "Series" }))).toEqual({ kind: "tmdb", tmdbId: 1396, mediaType: "tv" });
  });

  it("un titre TMDB : seulement avec une identité valable", () => {
    expect(trailerPreviewSubjectOfTitle({ mediaType: "movie", tmdbId: 603 })).toEqual({ kind: "tmdb", tmdbId: 603, mediaType: "movie" });
    expect(trailerPreviewSubjectOfTitle({ mediaType: "movie", tmdbId: 0 })).toBeNull();
    expect(trailerPreviewSubjectOfTitle({ mediaType: "movie", tmdbId: 1.5 })).toBeNull();
    expect(trailerPreviewSubjectOfTitle({ mediaType: "person" as never, tmdbId: 3 })).toBeNull();
    expect(trailerPreviewSubjectOfTitle(null)).toBeNull();
  });

  it("une clé par titre : deux cartes du même titre partagent la réponse", () => {
    expect(trailerPreviewSubjectKey({ kind: "item", itemId: MOVIE })).toBe(`item:${MOVIE}`);
    expect(trailerPreviewSubjectKey({ kind: "tmdb", tmdbId: 603, mediaType: "movie" })).toBe("tmdb:movie:603");
  });

  it("le chemin de la demande suit le contrat ; un identifiant illisible ne demande rien", () => {
    expect(trailerPreviewSubjectPath({ kind: "item", itemId: MOVIE }, "fr")).toBe(`/api/trailers/preview?itemId=${MOVIE}&lang=fr`);
    expect(trailerPreviewSubjectPath({ kind: "tmdb", tmdbId: 603, mediaType: "movie" }, "en"))
      .toBe("/api/trailers/preview?tmdbId=603&mediaType=movie&lang=en");
    expect(trailerPreviewSubjectPath({ kind: "item", itemId: "pas-un-id" }, "fr")).toBeNull();
  });
});
