import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import type { ExternalSearchItem } from "../search/pluginSearch";
import { buildSagaView, sagaCollectionIdOf } from "./sagaModel";
import type { SagaResponse } from "./sagaTypes";

/**
 * La rangée d'une saga : l'ordre de TMDB (sa date de sortie), le rang de
 * chaque film, les volets manquants intercalés à leur place, la fiche ouverte
 * et le prochain à voir — avec les mêmes règles que l'épisode suivant.
 */

const HP: SagaResponse = {
  collectionId: 1241,
  saga: {
    collectionId: 1241,
    name: "Harry Potter - Saga",
    parts: [
      { tmdbId: 671, title: "HP 1", releaseDate: "2001-11-16" },
      { tmdbId: 672, title: "HP 2", releaseDate: "2002-11-13" },
      { tmdbId: 674, title: "HP 4", releaseDate: "2005-11-16" },
      { tmdbId: 673, title: "HP 3", releaseDate: "2004-05-31" },
    ],
  },
  members: [
    { itemId: "hp1", tmdbId: 671 },
    { itemId: "hp2", tmdbId: 672 },
    { itemId: "hp4", tmdbId: 674 },
  ],
};

function film(id: string, year: number, userData: Partial<NonNullable<MediaItem["UserData"]>> = {}): MediaItem {
  return {
    Id: id, Name: `Film ${id}`, Type: "Movie", ProductionYear: year,
    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, ...userData },
  } as MediaItem;
}

const missing = (tmdbId: number, title: string, year: number): ExternalSearchItem => ({
  id: `movie:${tmdbId}`, kind: "movie", title, year, subtitle: String(year), imageUrl: null,
  href: `/discover?media=movie:${tmdbId}`, badge: null, tmdbId,
});

describe("sagaCollectionIdOf", () => {
  it("la saga d'un film, telle que Jellyfin l'a notée (casse indifférente)", () => {
    expect(sagaCollectionIdOf({ Id: "x", Name: "HP", Type: "Movie", ProviderIds: { TmdbCollection: "1241" } })).toBe(1241);
    expect(sagaCollectionIdOf({ Id: "x", Name: "HP", Type: "Movie", ProviderIds: { tmdbcollection: "1241" } })).toBe(1241);
  });
  it("rien pour une série, un film sans saga ou une valeur illisible", () => {
    expect(sagaCollectionIdOf({ Id: "x", Name: "S", Type: "Series", ProviderIds: { TmdbCollection: "9" } })).toBeNull();
    expect(sagaCollectionIdOf({ Id: "x", Name: "F", Type: "Movie", ProviderIds: { Tmdb: "1" } })).toBeNull();
    expect(sagaCollectionIdOf({ Id: "x", Name: "F", Type: "Movie", ProviderIds: { TmdbCollection: "abc" } })).toBeNull();
    expect(sagaCollectionIdOf(undefined)).toBeNull();
  });
});

describe("buildSagaView — la bibliothèque seule", () => {
  it("ordre et rangs de la saga, le trou d'un volet absent se lit dans les rangs", () => {
    const view = buildSagaView({ response: HP, items: [film("hp4", 2005), film("hp1", 2001), film("hp2", 2002)], currentId: "hp2" });
    expect(view?.entries.map((e) => [e.key, e.position])).toEqual([["hp1", 1], ["hp2", 2], ["hp4", 4]]);
    expect(view).toMatchObject({ name: "Harry Potter - Saga", partCount: 4, inLibrary: 3, watched: 0 });
  });

  it("la fiche ouverte est marquée ; rien de vu : le premier est à suivre", () => {
    const view = buildSagaView({ response: HP, items: [film("hp1", 2001), film("hp2", 2002), film("hp4", 2005)], currentId: "hp4" });
    expect(view?.entries.map((e) => e.cue)).toEqual(["upNext", null, "current"]);
  });

  it("un film entamé se reprend", () => {
    const items = [film("hp1", 2001, { Played: true }), film("hp2", 2002, { PlaybackPositionTicks: 5e9 }), film("hp4", 2005)];
    const view = buildSagaView({ response: HP, items, currentId: "hp1" });
    expect(view?.entries.map((e) => e.cue)).toEqual(["current", "resume", null]);
    expect(view?.watched).toBe(1);
  });

  it("le successeur du dernier VU, pas le premier trou", () => {
    const items = [
      film("hp1", 2001),
      film("hp2", 2002, { Played: true, LastPlayedDate: "2026-09-01T20:00:00Z" }),
      film("hp4", 2005),
    ];
    const view = buildSagaView({ response: HP, items, currentId: "hp1" });
    expect(view?.entries.find((e) => e.cue === "upNext")?.key).toBe("hp4");
  });

  it("le dernier volet vu clôt la saga : plus rien à suivre", () => {
    const items = [film("hp1", 2001, { Played: true }), film("hp2", 2002, { Played: true }), film("hp4", 2005, { Played: true })];
    const view = buildSagaView({ response: HP, items, currentId: "hp1" });
    expect(view?.entries.map((e) => e.cue)).toEqual(["current", null, null]);
  });

  it("un seul film en bibliothèque et pas de plugin : pas de rangée", () => {
    expect(buildSagaView({ response: HP, items: [film("hp1", 2001)], currentId: "hp1" })).toBeNull();
  });

  it("sans TMDB : titre générique, ordre de sortie, aucun rang ni total", () => {
    const view = buildSagaView({
      response: { ...HP, saga: null },
      items: [film("hp4", 2005), film("hp1", 2001)],
      currentId: "hp1",
    });
    expect(view?.entries.map((e) => [e.key, e.position])).toEqual([["hp1", null], ["hp4", null]]);
    expect(view).toMatchObject({ name: null, partCount: null, inLibrary: 2 });
  });
});

describe("buildSagaView — avec les volets manquants d'un plugin", () => {
  it("intercale le volet absent à son rang, et le compte dans la saga", () => {
    const view = buildSagaView({
      response: HP,
      items: [film("hp1", 2001), film("hp2", 2002), film("hp4", 2005)],
      external: [{ pluginId: "seer", items: [missing(673, "HP 3", 2004)] }],
      currentId: "hp1",
    });
    expect(view?.entries.map((e) => [e.kind, e.position])).toEqual([
      ["library", 1], ["library", 2], ["external", 3], ["library", 4],
    ]);
    expect(view).toMatchObject({ partCount: 4, inLibrary: 3 });
  });

  it("un seul film en bibliothèque suffit quand la saga en compte d'autres", () => {
    const view = buildSagaView({
      response: HP,
      items: [film("hp2", 2002)],
      external: [{ pluginId: "seer", items: [missing(671, "HP 1", 2001), missing(673, "HP 3", 2004)] }],
      currentId: "hp2",
    });
    expect(view?.entries.map((e) => e.key)).toEqual(["tmdb:671", "hp2", "tmdb:673"]);
  });

  it("ce que la bibliothèque a déjà n'est pas proposé deux fois", () => {
    const view = buildSagaView({
      response: HP,
      items: [film("hp1", 2001), film("hp2", 2002)],
      external: [{ pluginId: "seer", items: [missing(671, "HP 1 (doublon)", 2001), missing(673, "HP 3", 2004)] }],
      currentId: "hp1",
    });
    expect(view?.entries.filter((e) => e.kind === "external").map((e) => e.key)).toEqual(["tmdb:673"]);
  });

  it("le prochain volet à voir peut être celui qui manque", () => {
    const view = buildSagaView({
      response: HP,
      items: [film("hp1", 2001), film("hp2", 2002, { Played: true }), film("hp4", 2005)],
      external: [{ pluginId: "seer", items: [missing(673, "HP 3", 2004)] }],
      currentId: "hp1",
    });
    expect(view?.entries.find((e) => e.cue === "upNext")?.key).toBe("tmdb:673");
  });
});
