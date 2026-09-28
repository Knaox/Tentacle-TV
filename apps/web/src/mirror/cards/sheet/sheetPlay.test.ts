import { describe, expect, it } from "vitest";
import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { isPlayableCard, sheetPlayLabel, sheetPlayPlan } from "./sheetPlay";

const TICK = 600_000_000;

function item(partial: Partial<MediaItem>): MediaItem {
  return { Id: "x", Name: "Titre", Type: "Movie", ...partial } as MediaItem;
}

const label = (plan: Parameters<typeof sheetPlayLabel>[0]) =>
  sheetPlayLabel(plan, (key) => (key === "resume" ? "Reprendre" : "Lire"));

describe("sheetPlayPlan", () => {
  it("lance un film tel quel, et dit « Reprendre » s'il est entamé", () => {
    const fresh = sheetPlayPlan(item({ Id: "m1", RunTimeTicks: 100 * TICK }), undefined);
    expect(fresh).toMatchObject({ targetId: "m1", resume: false, episodeCode: null, progress: null });
    const started = sheetPlayPlan(
      item({ Id: "m1", RunTimeTicks: 100 * TICK, UserData: { PlaybackPositionTicks: 40 * TICK, PlayedPercentage: 40 } as MediaItem["UserData"] }),
      undefined,
    );
    expect(started).toMatchObject({ targetId: "m1", resume: true, remainingMinutes: 60 });
    expect(started?.progress).toBeCloseTo(0.4);
    expect(label(started!)).toBe("Reprendre");
  });

  it("donne son code à un épisode", () => {
    const plan = sheetPlayPlan(item({ Id: "e1", Type: "Episode", ParentIndexNumber: 2, IndexNumber: 5 }), undefined);
    expect(plan?.episodeCode).toBe("S2 · E5");
    expect(label(plan!)).toBe("Lire S2 · E5");
  });

  it("lance l'épisode que l'état d'une série désigne", () => {
    const episode = item({ Id: "e7", Type: "Episode", ParentIndexNumber: 1, IndexNumber: 7 });
    const state: NextEpisodeResult = { type: "continue", episode, positionTicks: 10 };
    const plan = sheetPlayPlan(item({ Id: "s1", Type: "Series" }), state);
    expect(plan).toMatchObject({ targetId: "e7", resume: true, episodeCode: "S1 · E7" });
    expect(label(plan!)).toBe("Reprendre S1 · E7");
  });

  it("ouvre la fiche d'une série terminée ou pas encore résolue", () => {
    const series = item({ Id: "s1", Type: "Series" });
    expect(sheetPlayPlan(series, { type: "completed" })).toMatchObject({ targetId: null, resume: false, episodeCode: null });
    expect(sheetPlayPlan(series, undefined)).toMatchObject({ targetId: null, resume: false });
  });

  it("ne lance ni collection ni saison", () => {
    expect(sheetPlayPlan(item({ Type: "BoxSet" }), undefined)).toBeNull();
    expect(isPlayableCard({ Type: "Season" })).toBe(false);
    expect(isPlayableCard({ Type: "Series" })).toBe(true);
  });
});
