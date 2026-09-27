/**
 * L'étape de visionnage d'un titre de Ma liste se lit sans requête, et ses
 * trois valeurs ne se recouvrent jamais : c'est ce qui permet aux pastilles de
 * la page d'afficher des comptes qui s'additionnent.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  filterByWatchStage,
  parseWatchStageFilter,
  resumeQueue,
  summarizeWatchlist,
  watchProgress,
  watchRemaining,
  watchStage,
} from "./watchlistProgress";

function item(p: Partial<MediaItem>, data?: Partial<MediaItem["UserData"]>): MediaItem {
  return {
    Id: "id",
    Name: "Titre",
    Type: "Movie",
    ...p,
    UserData: data ? { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, ...data } : undefined,
  } as MediaItem;
}

describe("watchStage", () => {
  it("classe un film neuf, commencé, vu", () => {
    expect(watchStage(item({}))).toBe("new");
    expect(watchStage(item({}, { PlaybackPositionTicks: 10 }))).toBe("inProgress");
    expect(watchStage(item({}, { Played: true, PlaybackPositionTicks: 10 }))).toBe("watched");
  });

  it("lit une série à ses épisodes vus", () => {
    expect(watchStage(item({ Type: "Series" }, { PlayCount: 0 }))).toBe("new");
    expect(watchStage(item({ Type: "Series" }, { PlayCount: 3 }))).toBe("inProgress");
  });
});

describe("watchProgress et watchRemaining", () => {
  it("borne le pourcentage et affirme 100 pour un titre vu", () => {
    expect(watchProgress(item({}))).toBeNull();
    expect(watchProgress(item({}, { PlayedPercentage: 42 }))).toBe(42);
    expect(watchProgress(item({}, { PlayedPercentage: 140 }))).toBe(100);
    expect(watchProgress(item({ Type: "Series" }, { Played: true }))).toBe(100);
  });

  it("compte des minutes pour un film, des épisodes pour une série", () => {
    const film = item({ RunTimeTicks: 600_000_000 * 100 }, { PlaybackPositionTicks: 600_000_000 * 40 });
    expect(watchRemaining(film)).toEqual({ kind: "minutes", value: 60 });
    const serie = item({ Type: "Series" }, { PlayCount: 2, UnplayedItemCount: 5 });
    expect(watchRemaining(serie)).toEqual({ kind: "episodes", value: 5 });
    expect(watchRemaining(item({}))).toBeNull();
  });
});

describe("résumé, filtre et file de reprise", () => {
  const liste = [
    item({ Id: "neuf" }),
    item({ Id: "ancien" }, { PlaybackPositionTicks: 5, LastPlayedDate: "2026-01-01T00:00:00Z" }),
    item({ Id: "recent" }, { PlaybackPositionTicks: 5, LastPlayedDate: "2026-09-01T00:00:00Z" }),
    item({ Id: "vu" }, { Played: true }),
  ];

  it("des comptes qui s'additionnent", () => {
    expect(summarizeWatchlist(liste)).toEqual({ total: 4, new: 1, inProgress: 2, watched: 1 });
  });

  it("rend la même référence sans filtre", () => {
    expect(filterByWatchStage(liste, "all")).toBe(liste);
    expect(filterByWatchStage(liste, "watched").map((i) => i.Id)).toEqual(["vu"]);
  });

  it("met le dernier regardé en tête", () => {
    expect(resumeQueue(liste).map((i) => i.Id)).toEqual(["recent", "ancien"]);
  });

  it("ignore une valeur d'adresse inconnue", () => {
    expect(parseWatchStageFilter("inProgress")).toBe("inProgress");
    expect(parseWatchStageFilter("n'importe")).toBe("all");
    expect(parseWatchStageFilter(null)).toBe("all");
  });
});
