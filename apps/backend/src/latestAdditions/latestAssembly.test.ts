import { describe, expect, it } from "vitest";
import { assembleLatestItems, latestResponseBody } from "./latestAssembly";
import type { LatestCard } from "./latestGrouping";
import type { LatestAdditions } from "./latestAdditionsTypes";

const additions = (episodes: number): LatestAdditions => ({
  EpisodeCount: episodes,
  SeasonNumbers: [2],
  NewSeasonNumbers: [2],
  NewSeries: false,
  LatestDate: "2026-10-02T20:00:00.000Z",
  LatestSeasonId: "s2",
  LatestSeasonNumber: 2,
});

const PLAN: LatestCard[] = [
  { kind: "series", seriesId: "A", additions: additions(8) },
  { kind: "item", id: "m1" },
  { kind: "item", id: "e9" },
];

/** Ce que Jellyfin rend pour `Ids=` — dans SON ordre, pas celui de la rangée. */
const DETAILS = [
  { Id: "e9", Name: "Épisode 9", Type: "Episode", SeriesId: "B" },
  { Id: "m1", Name: "Film", Type: "Movie", ProductionYear: 2024 },
  { Id: "A", Name: "Série A", Type: "Series", DateCreated: "2024-01-01T00:00:00Z", UserData: { Played: false } },
];

describe("assembleLatestItems", () => {
  it("rend les cartes dans l'ordre de la rangée, la série regroupée enrichie sans rien perdre", () => {
    const items = assembleLatestItems(PLAN, DETAILS);
    expect(items.map((i) => i.Id)).toEqual(["A", "m1", "e9"]);
    expect(items[0]).toEqual({
      Id: "A", Name: "Série A", Type: "Series", UserData: { Played: false },
      // La date de la série n'est pas réécrite : la date du groupe est dans `LatestAdditions`.
      DateCreated: "2024-01-01T00:00:00Z",
      RecentlyAddedCount: 8,
      LatestAdditions: additions(8),
    });
    expect(items[1]).toBe(DETAILS[1]);
    expect(items[2]).toBe(DETAILS[0]);
  });

  it("une carte que Jellyfin ne rend pas disparaît", () => {
    expect(assembleLatestItems(PLAN, DETAILS.slice(0, 2)).map((i) => i.Id)).toEqual(["m1", "e9"]);
  });

  it("sans épisode (une saison seule), pas de compteur pour les clients installés", () => {
    const [series] = assembleLatestItems([{ kind: "series", seriesId: "A", additions: additions(0) }], DETAILS);
    expect(series).not.toHaveProperty("RecentlyAddedCount");
    expect(series.LatestAdditions).toEqual(additions(0));
  });

  it("la réponse a la forme de `/Items`", () => {
    expect(JSON.parse(latestResponseBody([{ Id: "x" }]))).toEqual({ Items: [{ Id: "x" }], TotalRecordCount: 1, StartIndex: 0 });
  });
});
