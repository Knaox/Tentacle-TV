import { describe, expect, it } from "vitest";
import { cappedReleaseParams, isReleasedOn, isReleasedResult, releaseDateOf } from "./released";

const NOW = new Date("2026-09-04T12:00:00Z");

describe("isReleasedOn", () => {
  it("le jour même et le passé sont sortis, le futur non", () => {
    expect(isReleasedOn("2026-09-04", NOW)).toBe(true);
    expect(isReleasedOn("2020-01-01", NOW)).toBe(true);
    expect(isReleasedOn("2026-09-05", NOW)).toBe(false);
    expect(isReleasedOn("2027-03-12", NOW)).toBe(false);
  });

  it("sans date, ou avec une date tronquée : on ne sait pas, donc non", () => {
    expect(isReleasedOn(undefined, NOW)).toBe(false);
    expect(isReleasedOn("", NOW)).toBe(false);
    expect(isReleasedOn("2026", NOW)).toBe(false);
  });
});

describe("isReleasedResult / releaseDateOf", () => {
  it("lit les champs TMDB et Vigie, film ou série", () => {
    expect(releaseDateOf({ release_date: "2024-05-01" })).toBe("2024-05-01");
    expect(releaseDateOf({ first_air_date: "2024-05-01" })).toBe("2024-05-01");
    expect(releaseDateOf({ releaseDate: "2024-05-01" })).toBe("2024-05-01");
    expect(releaseDateOf({ firstAirDate: "2024-05-01" })).toBe("2024-05-01");
    expect(isReleasedResult({ first_air_date: "2026-12-25" }, NOW)).toBe(false);
    expect(isReleasedResult({ releaseDate: "2026-09-01" }, NOW)).toBe(true);
    expect(isReleasedResult({}, NOW)).toBe(false);
  });
});

describe("cappedReleaseParams", () => {
  it("plafonne à aujourd'hui, garde une borne déjà plus tôt, par type de média", () => {
    expect(cappedReleaseParams("movie", { sort_by: "x" }, NOW)).toEqual({ sort_by: "x", "primary_release_date.lte": "2026-09-04" });
    expect(cappedReleaseParams("tv", {}, NOW)).toEqual({ "first_air_date.lte": "2026-09-04" });
    expect(cappedReleaseParams("movie", { "primary_release_date.lte": "2029-12-31" }, NOW)["primary_release_date.lte"]).toBe("2026-09-04");
    expect(cappedReleaseParams("movie", { "primary_release_date.lte": "1999-12-31" }, NOW)["primary_release_date.lte"]).toBe("1999-12-31");
  });
});
