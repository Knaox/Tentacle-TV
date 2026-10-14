import { describe, expect, it } from "vitest";
import { parseTrailerRoute, trailerRouteHref, type TrailerRoute } from "./trailerRoute";

const ITEM = "3544678b1e6fa2d541ff656d5561a271";
const paramsOf = (href: string) => Object.fromEntries(new URLSearchParams(href.split("?")[1]));

describe("l'écran des bandes-annonces › sa route", () => {
  it("relit exactement ce qu'elle écrit : un titre, un titre TMDB et sa saison, une vidéo YouTube", () => {
    const routes: TrailerRoute[] = [
      { target: { kind: "item", itemId: ITEM, itemType: "Episode" }, start: "dm:x8e90ff" },
      { target: { kind: "tmdb", tmdbId: 60625, mediaType: "tv", season: 7 }, start: "yt:WNhH00OIPP0" },
      { target: { kind: "tmdb", tmdbId: 329865, mediaType: "movie" } },
      { target: { kind: "youtube", ytId: "WNhH00OIPP0", name: "Season 1 Promos" } },
    ];
    for (const route of routes) {
      const href = trailerRouteHref(route);
      expect(href.startsWith("/trailer?")).toBe(true);
      expect(parseTrailerRoute(paramsOf(href))).toEqual(route);
    }
  });

  it("un départ mal formé est omis ; une demande illisible ne donne rien", () => {
    expect(trailerRouteHref({ target: { kind: "youtube", ytId: "WNhH00OIPP0" }, start: "javascript:x" })).toBe("/trailer?yt=WNhH00OIPP0");
    expect(parseTrailerRoute({ itemId: ITEM, type: "BoxSet" })).toBeNull();
    expect(parseTrailerRoute({ itemId: "../x", type: "Movie" })).toBeNull();
    expect(parseTrailerRoute({ tmdbId: "0", mediaType: "tv" })).toBeNull();
    expect(parseTrailerRoute({ yt: "court" })).toBeNull();
    expect(parseTrailerRoute({})).toBeNull();
  });

  it("une saison sur un film est ignorée ; les paramètres en double prennent le premier", () => {
    expect(parseTrailerRoute({ tmdbId: "1", mediaType: "movie", season: "2" })).toEqual({ target: { kind: "tmdb", tmdbId: 1, mediaType: "movie" } });
    expect(parseTrailerRoute({ yt: ["WNhH00OIPP0", "autreautre1"] })).toEqual({ target: { kind: "youtube", ytId: "WNhH00OIPP0" } });
  });
});
