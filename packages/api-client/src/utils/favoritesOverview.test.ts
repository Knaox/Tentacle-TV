/**
 * Ce qui est vérifié ici : le bilan et les sections des titres likés, et
 * surtout l'ACCORD entre l'état « à reprendre / pas encore vu » d'une tuile et
 * le filtre de statut du même nom — deux définitions qui divergeraient
 * afficheraient un compte que le filtre ne retrouve pas.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { filterCollection, type CollectionFilterInput } from "./collectionFilter";
import { favoriteWatchState, groupFavorites, summarizeFavorites } from "./favoritesOverview";

function item(p: Partial<MediaItem>): MediaItem {
  return { Id: "id", Name: "Titre", Type: "Movie", ...p } as MediaItem;
}

function ud(p: Partial<MediaItem["UserData"]>): MediaItem["UserData"] {
  return { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: true, Played: false, ...p };
}

const SAMPLE: MediaItem[] = [
  item({ Id: "a", Type: "Movie", ProductionYear: 1994, Genres: ["Drame", "Crime"], RunTimeTicks: 9_000_000_000_0, UserData: ud({ Played: true }) }),
  item({ Id: "b", Type: "Series", ProductionYear: 2019, Genres: ["Drame"], UserData: ud({ PlayCount: 2 }) }),
  item({ Id: "c", Type: "Movie", ProductionYear: 2021, Genres: ["Action"], RunTimeTicks: 6_000_000_000_0, UserData: ud({ PlaybackPositionTicks: 10 }) }),
  item({ Id: "d", Type: "Series", Genres: [], UserData: ud({}) }),
  item({ Id: "e", Type: "Movie", ProductionYear: 2015, Genres: ["Drame"], UserData: ud({ PlayedPercentage: 40 }) }),
];

const NEUTRAL: CollectionFilterInput = {
  search: "", type: "all", genres: [], yearFrom: null, yearTo: null, ratingMin: null,
  statusFilter: null, sortBy: "DateCreated", sortOrder: "Descending",
};

describe("favoriteWatchState", () => {
  it("s'accorde avec le filtre de statut de filterCollection", () => {
    const resumable = new Set(filterCollection(SAMPLE, { ...NEUTRAL, statusFilter: "IsResumable" }).map((i) => i.Id));
    const unplayed = new Set(filterCollection(SAMPLE, { ...NEUTRAL, statusFilter: "IsUnplayed" }).map((i) => i.Id));
    for (const it of SAMPLE) {
      const state = favoriteWatchState(it);
      expect(resumable.has(it.Id)).toBe(state === "resume");
      expect(unplayed.has(it.Id)).toBe(state !== "played");
    }
  });
});

describe("summarizeFavorites", () => {
  it("compte les types, les états et la durée des films seuls", () => {
    expect(summarizeFavorites(SAMPLE)).toEqual({
      total: 5, movies: 3, series: 2, resume: 3, unplayed: 1, played: 1, movieMinutes: 250,
    });
  });
});

describe("groupFavorites", () => {
  it("« none » rend une seule section, ou aucune sur une liste vide", () => {
    expect(groupFavorites(SAMPLE, "none")).toHaveLength(1);
    expect(groupFavorites([], "none")).toEqual([]);
  });

  it("garde l'ordre reçu à l'intérieur d'une section", () => {
    const [movies, series] = groupFavorites(SAMPLE, "type");
    expect(movies.value).toBe("Movie");
    expect(movies.items.map((i) => i.Id)).toEqual(["a", "c", "e"]);
    expect(series.items.map((i) => i.Id)).toEqual(["b", "d"]);
  });

  it("range les états dans l'ordre de l'action et tait les sections vides", () => {
    expect(groupFavorites(SAMPLE, "status").map((g) => g.value)).toEqual(["resume", "unplayed", "played"]);
    expect(groupFavorites([SAMPLE[0]], "status").map((g) => g.value)).toEqual(["played"]);
  });

  it("classe les genres principaux par effectif, les sans-genre à la fin", () => {
    expect(groupFavorites(SAMPLE, "genre").map((g) => [g.value, g.items.length])).toEqual([
      ["Drame", 3], ["Action", 1], [null, 1],
    ]);
  });

  it("classe les décennies de la plus récente à la plus ancienne", () => {
    expect(groupFavorites(SAMPLE, "decade").map((g) => g.value)).toEqual(["2020", "2010", "1990", null]);
  });
});
