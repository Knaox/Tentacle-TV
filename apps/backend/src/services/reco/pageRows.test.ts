import { describe, expect, it } from "vitest";
import type { PageSnapshot, SnapshotRow } from "./pageSnapshot";
import type { RecoRowItem } from "./rowItem";
import { applyServeExclusions, dropThinRows, filterRowItems, snapshotStaleReason, utcDayKey } from "./pageRows";

const item = (key: string): RecoRowItem => ({
  key,
  mediaType: "movie",
  tmdbId: Number(key.split(":")[1]),
  title: key,
  year: null,
  posterPath: null,
  backdropPath: null,
  jellyfinItemId: null,
  source: "tmdb_discover",
  score: 1,
  voteAverage: null,
  reasons: [],
  providers: null,
});
const row = (key: string, ...keys: string[]): SnapshotRow => ({ key, items: keys.map(item) });

describe("applyServeExclusions", () => {
  it("retire les clés exclues, omet une rangée vidée, ne mute pas", () => {
    const rows = [row("forYou", "movie:1", "movie:2"), row("trending", "movie:2")];
    const out = applyServeExclusions(rows, new Set(["movie:2"]));
    expect(out).toEqual([{ key: "forYou", items: [item("movie:1")] }]);
    expect(rows[0].items).toHaveLength(2);
    expect(applyServeExclusions(rows, new Set())).toEqual(rows);
  });
});

describe("filterRowItems / dropThinRows", () => {
  it("filtre item par item, puis écarte les rangées minces", () => {
    const rows = [row("a", "movie:1", "movie:2", "movie:3", "movie:4"), row("b", "movie:5")];
    expect(filterRowItems(rows, (i) => i.tmdbId !== 5)).toEqual([rows[0]]);
    expect(dropThinRows(rows, 4).map((r) => r.key)).toEqual(["a"]);
  });
});

describe("snapshotStaleReason", () => {
  const snapshot: PageSnapshot = {
    version: 1,
    builtAt: "2026-09-04T10:00:00.000Z",
    dayKey: "2026-09-04",
    state: "ready",
    poolGeneratedAt: "2026-09-04T09:00:00.000Z",
    poolPreliminary: false,
    profileComputedAt: "2026-09-04T08:00:00.000Z",
    settingsUpdatedAt: "2026-09-01T00:00:00.000Z",
    globalsGeneratedAt: "2026-09-04T06:00:00.000Z",
    filter: null,
    rows: [],
  };
  const fresh = {
    now: new Date("2026-09-04T12:00:00.000Z"),
    state: "ready" as const,
    poolGeneratedAt: snapshot.poolGeneratedAt,
    profileComputedAt: snapshot.profileComputedAt,
    settingsUpdatedAt: snapshot.settingsUpdatedAt,
    globalsGeneratedAt: snapshot.globalsGeneratedAt,
  };

  it("frais quand tout concorde", () => {
    expect(snapshotStaleReason(snapshot, fresh)).toBeNull();
  });

  it("chaque sonde a sa raison, dans l'ordre de priorité", () => {
    expect(snapshotStaleReason(snapshot, { ...fresh, state: "warming" })).toBe("state");
    expect(snapshotStaleReason(snapshot, { ...fresh, poolGeneratedAt: "2026-09-04T11:00:00.000Z" })).toBe("pool");
    expect(snapshotStaleReason(snapshot, { ...fresh, profileComputedAt: null })).toBe("profile");
    expect(snapshotStaleReason(snapshot, { ...fresh, settingsUpdatedAt: "2026-09-04T11:00:00.000Z" })).toBe("settings");
    expect(snapshotStaleReason(snapshot, { ...fresh, globalsGeneratedAt: null })).toBe("globals");
    expect(snapshotStaleReason(snapshot, { ...fresh, now: new Date("2026-09-05T00:00:00.000Z") })).toBe("day");
    expect(snapshotStaleReason(snapshot, { ...fresh, now: new Date("2026-09-04T16:00:00.000Z") })).toBe("age");
    expect(snapshotStaleReason(snapshot, { ...fresh, now: new Date("2026-09-04T15:59:59.000Z") })).toBeNull();
  });

  it("la clé de jour est UTC", () => {
    expect(utcDayKey("2026-09-04T23:59:59.000Z")).toBe("2026-09-04");
    expect(utcDayKey("2026-09-05T00:00:00.000Z")).toBe("2026-09-05");
  });
});
