import { describe, expect, it } from "vitest";
import type { DownloadListEntry as DownloadEntry } from "../core/listing";
import { isInProgress, pickHeroEntries, pickResumeEntries, pickSeriesPlayTarget, remainingTicks } from "./offlineHighlights";

let nextId = 1;
function entry(over: Partial<DownloadEntry> = {}): DownloadEntry {
  const id = nextId++;
  return {
    id,
    itemId: `item${id}`,
    mediaSourceId: `ms${id}`,
    variant: "original",
    preset: null,
    relPath: `media/item${id}/original-ms${id}.mkv`,
    expectedSize: null,
    bytesDone: 0,
    status: "complete",
    errorCode: null,
    audioStreamIndex: null,
    burnSubtitleIndex: null,
    title: `Titre ${id}`,
    seriesName: null,
    kind: "movie",
    seriesId: null,
    seasonId: null,
    indexNumber: null,
    parentIndexNumber: null,
    runtimeTicks: 60 * 600_000_000,
    autoDeleteAfterWatch: false,
    autoDeleteDelayMinutes: 0,
    deleteScheduledAt: null,
    played: false,
    positionTicks: 0,
    createdAt: id,
    lastPlayedAt: null,
    pausedByUser: false,
    libraryId: null,
    ...over,
  };
}

const episode = (series: string, season: number, number: number, over: Partial<DownloadEntry> = {}) =>
  entry({ kind: "episode", seriesId: `s-${series}`, seriesName: series, parentIndexNumber: season, indexNumber: number, ...over });

describe("isInProgress / remainingTicks", () => {
  it("un titre entamé et pas vu est en cours ; un transfert ne l'est jamais", () => {
    expect(isInProgress(entry({ positionTicks: 10 }))).toBe(true);
    expect(isInProgress(entry({ positionTicks: 10, played: true }))).toBe(false);
    expect(isInProgress(entry({ positionTicks: 0 }))).toBe(false);
    expect(isInProgress(entry({ positionTicks: 10, status: "downloading" }))).toBe(false);
  });

  it("compte ce qui reste, jamais moins que zéro, rien sans durée", () => {
    expect(remainingTicks(entry({ positionTicks: 10 * 600_000_000 }))).toBe(50 * 600_000_000);
    expect(remainingTicks(entry({ positionTicks: 99 * 600_000_000 }))).toBe(0);
    expect(remainingTicks(entry({ runtimeTicks: null, positionTicks: 5 }))).toBe(0);
  });
});

describe("pickResumeEntries", () => {
  it("classe les reprises par dernière lecture, les dates nulles après, puis par ajout", () => {
    const old = entry({ positionTicks: 1, lastPlayedAt: 100 });
    const recent = entry({ positionTicks: 1, lastPlayedAt: 900 });
    const undated = entry({ positionTicks: 1, lastPlayedAt: null, createdAt: 50 });
    const undatedNewer = entry({ positionTicks: 1, lastPlayedAt: null, createdAt: 70 });
    const untouched = entry({ positionTicks: 0 });

    expect(pickResumeEntries([old, untouched, undated, recent, undatedNewer]).map((e) => e.id)).toEqual([
      recent.id, old.id, undatedNewer.id, undated.id,
    ]);
  });

  it("plafonne", () => {
    const list = [1, 2, 3].map((n) => entry({ positionTicks: 1, lastPlayedAt: n }));
    expect(pickResumeEntries(list, 2)).toHaveLength(2);
  });
});

describe("pickHeroEntries", () => {
  it("reprises d'abord, puis nouveautés, puis vus — une diapositive par série", () => {
    const e1 = episode("Malcolm", 1, 1, { positionTicks: 1, lastPlayedAt: 10 });
    const e2 = episode("Malcolm", 1, 2, { positionTicks: 1, lastPlayedAt: 20 });
    const film = entry({ createdAt: 500 });
    const seen = entry({ played: true, createdAt: 900 });
    const other = episode("Dark", 1, 1, { createdAt: 700 });
    const active = entry({ status: "downloading", createdAt: 999 });

    expect(pickHeroEntries([e1, film, seen, e2, other, active]).map((e) => e.id)).toEqual([
      e2.id, other.id, film.id, seen.id,
    ]);
  });

  it("plafonne et ignore les transferts", () => {
    const list = [1, 2, 3, 4, 5, 6].map((n) => entry({ createdAt: n }));
    const picked = pickHeroEntries(list, 5);
    expect(picked).toHaveLength(5);
    expect(picked[0]?.createdAt).toBe(6);
  });
});

describe("pickSeriesPlayTarget", () => {
  it("l'entamé le plus récent, sinon le premier non vu, sinon le premier", () => {
    const s1e1 = episode("M", 1, 1, { played: true });
    const s1e2 = episode("M", 1, 2, { positionTicks: 5, lastPlayedAt: 10 });
    const s1e3 = episode("M", 1, 3, { positionTicks: 5, lastPlayedAt: 30 });
    const s2e1 = episode("M", 2, 1);

    expect(pickSeriesPlayTarget([s2e1, s1e3, s1e1, s1e2])?.id).toBe(s1e3.id);
    expect(pickSeriesPlayTarget([s2e1, s1e1])?.id).toBe(s2e1.id);
    expect(pickSeriesPlayTarget([episode("M", 1, 2, { played: true }), episode("M", 1, 1, { played: true })])?.indexNumber).toBe(1);
    expect(pickSeriesPlayTarget([])).toBeNull();
  });
});
