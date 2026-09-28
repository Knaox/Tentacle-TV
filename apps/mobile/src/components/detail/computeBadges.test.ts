import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { detailPlayCta } from "./computeBadges";

const t = (key: string) => key;
const MIN = 60 * 10_000_000;

describe("bouton Lecture de la fiche", () => {
  it("série terminée ou collection : pas de bouton", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    expect(detailPlayCta(series, { type: "completed" }, t).targetId).toBeNull();
    expect(detailPlayCta(series, undefined, t).targetId).toBeNull();
    expect(detailPlayCta({ Id: "b", Type: "BoxSet" } as MediaItem, undefined, t).targetId).toBeNull();
  });

  it("série : l'épisode visé, son code et sa reprise", () => {
    const series = { Id: "s", Type: "Series" } as MediaItem;
    const ep = { Id: "e", Type: "Episode", ParentIndexNumber: 2, IndexNumber: 3, RunTimeTicks: 40 * MIN, UserData: { PlaybackPositionTicks: 10 * MIN } } as MediaItem;
    expect(detailPlayCta(series, { type: "continue", episode: ep }, t)).toEqual({ targetId: "e", label: "resume · S02E03", progress: 0.25, remainingMinutes: 30 });
    const fresh = { Id: "f", Type: "Episode", IndexNumber: 1 } as MediaItem;
    expect(detailPlayCta(series, { type: "start", episode: fresh }, t).label).toBe("play · S01E01");
  });

  it("film entamé : avancement et temps restant ; sinon « Lecture »", () => {
    const movie = { Id: "m", Type: "Movie", RunTimeTicks: 120 * MIN, UserData: { PlaybackPositionTicks: 30 * MIN } } as MediaItem;
    expect(detailPlayCta(movie, undefined, t)).toEqual({ targetId: "m", label: "resume", progress: 0.25, remainingMinutes: 90 });
    expect(detailPlayCta({ Id: "m", Type: "Movie" } as MediaItem, undefined, t)).toEqual({ targetId: "m", label: "play", progress: null, remainingMinutes: null });
  });
});
