import { describe, expect, it } from "vitest";
import { playbackEndsAt, releaseLabel } from "./mediaFacts";

describe("releaseLabel", () => {
  it("une série terminée, en cours, ou d'une seule année", () => {
    expect(releaseLabel({ Type: "Series", ProductionYear: 2008, EndDate: "2013-09-29T00:00:00Z", Status: "Ended" }, "fr")).toBe("2008 – 2013");
    expect(releaseLabel({ Type: "Series", ProductionYear: 2019, Status: "Continuing" }, "fr")).toBe("2019 –");
    expect(releaseLabel({ Type: "Series", ProductionYear: 2019, EndDate: "2019-12-01T00:00:00Z", Status: "Ended" }, "fr")).toBe("2019");
  });

  it("un film : sa date, sinon son année", () => {
    expect(releaseLabel({ Type: "Movie", PremiereDate: "1994-09-23T00:00:00Z" }, "en-US")).toBe("September 23, 1994");
    expect(releaseLabel({ Type: "Movie", ProductionYear: 1994 }, "fr")).toBe("1994");
    expect(releaseLabel({ Type: "Movie" }, "fr")).toBeNull();
  });
});

describe("playbackEndsAt", () => {
  const now = Date.UTC(2026, 8, 28, 20, 0, 0);
  it("depuis le début, ou depuis la reprise", () => {
    expect(playbackEndsAt({ Type: "Movie", RunTimeTicks: 2 * 3600 * 1e7 }, now)?.getTime()).toBe(now + 2 * 3600 * 1000);
    expect(playbackEndsAt({
      Type: "Movie", RunTimeTicks: 2 * 3600 * 1e7,
      UserData: { PlaybackPositionTicks: 3600 * 1e7, PlayCount: 0, IsFavorite: false, Played: false },
    }, now)?.getTime()).toBe(now + 3600 * 1000);
  });

  it("rien pour une série, sans durée, ou presque fini", () => {
    expect(playbackEndsAt({ Type: "Series", RunTimeTicks: 3e10 }, now)).toBeNull();
    expect(playbackEndsAt({ Type: "Movie" }, now)).toBeNull();
    expect(playbackEndsAt({
      Type: "Movie", RunTimeTicks: 600 * 1e7,
      UserData: { PlaybackPositionTicks: 570 * 1e7, PlayCount: 0, IsFavorite: false, Played: false },
    }, now)).toBeNull();
  });
});
