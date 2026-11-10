import { describe, expect, it } from "vitest";
import { queueLotLabel } from "./queueLotLabel";

const episode = (id: string, status: string, season = 1, series = "Caminandes") =>
  ({ status, kind: "episode", title: `Épisode ${id}`, itemId: id, seriesName: series, seriesId: `s-${series}`, parentIndexNumber: season }) as never;
const movie = (id: string, status: string) =>
  ({ status, kind: "movie", title: `Film ${id}`, itemId: id, seriesName: null, seriesId: null, parentIndexNumber: null }) as never;

describe("queueLotLabel", () => {
  it("ne nomme rien quand rien ne transite", () => {
    expect(queueLotLabel([episode("1", "complete"), movie("2", "canceled")])).toBeNull();
  });

  it("nomme la saison quand tout ce qui transite en est", () => {
    expect(queueLotLabel([episode("1", "complete"), episode("2", "downloading"), episode("3", "queued")])).toEqual({
      kind: "season",
      series: "Caminandes",
      season: 1,
    });
  });

  it("nomme la série quand plusieurs saisons transitent", () => {
    expect(queueLotLabel([episode("1", "paused", 1), episode("2", "queued", 2)])).toEqual({ kind: "series", series: "Caminandes" });
  });

  it("nomme le film seul, et compte un lot mêlé", () => {
    expect(queueLotLabel([movie("7", "error")])).toEqual({ kind: "title", title: "Film 7" });
    expect(queueLotLabel([movie("7", "downloading"), episode("1", "queued")])).toEqual({ kind: "mixed", count: 2 });
  });

  it("un épisode seul dit sa série et sa saison", () => {
    expect(queueLotLabel([episode("4", "downloading", 2)])).toEqual({ kind: "season", series: "Caminandes", season: 2 });
  });
});
