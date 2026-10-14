import { describe, expect, it } from "vitest";
import type { TrailerEntry } from "../trailers";
import { ficheExtrasPlan, type FicheSeason } from "./ficheExtras";

const season = (n: number, counts: Partial<FicheSeason> = {}): FicheSeason => ({ Id: `s${n}`, Name: `Saison ${n}`, IndexNumber: n, LocalTrailerCount: 0, SpecialFeatureCount: 0, ...counts });
const entry = (scope: TrailerEntry["scope"], videoId: string): TrailerEntry => ({
  scope, playback: { kind: "dailymotion", videoId }, name: videoId, version: "localized", type: "trailer", source: "allocine",
});
const S6 = entry({ kind: "season", season: 6 }, "x8saison6");
const SERIES = entry({ kind: "series" }, "x8serie00");
const SEASONS = [season(5, { SpecialFeatureCount: 2 }), season(6), season(7)];

describe("extras › UN carrousel par fiche", () => {
  it("série : ses extras et ceux de toutes ses saisons, réunis", () => {
    const plan = ficheExtrasPlan({ type: "Series", seasons: SEASONS, entries: [S6, SERIES], language: "fr", catalog: true });
    expect(plan.seasons.map((s) => s.Id)).toEqual(["s5"]);
    expect(plan.catalog?.entries).toEqual([S6, SERIES]);
    expect(plan.seasonOnly).toBeNull();
  });

  it("épisode dont la saison a des extras : ceux de SA saison seulement", () => {
    const plan = ficheExtrasPlan({ type: "Episode", seasonNumber: 6, seasons: SEASONS, entries: [S6, SERIES], language: "fr", catalog: true });
    expect(plan).toMatchObject({ seasonOnly: { Id: "s6" }, withSeries: false });
    expect(plan.catalog?.entries).toEqual([S6]);
  });

  it("épisode dont la saison n'a rien : tous les autres (la série, les autres saisons)", () => {
    const plan = ficheExtrasPlan({ type: "Episode", seasonNumber: 7, seasons: SEASONS, entries: [S6, SERIES], language: "fr", catalog: true });
    expect(plan).toMatchObject({ seasonOnly: null, withSeries: true });
    expect(plan.seasons.map((s) => s.Id)).toEqual(["s5"]);
    expect(plan.catalog?.entries).toEqual([S6, SERIES]);
  });

  it("sans catalogue : les extras de Jellyfin seuls décident", () => {
    const plan = ficheExtrasPlan({ type: "Episode", seasonNumber: 5, seasons: SEASONS, entries: [S6], language: "fr", catalog: false });
    expect(plan).toMatchObject({ seasonOnly: { Id: "s5" }, catalog: null });
  });
});
