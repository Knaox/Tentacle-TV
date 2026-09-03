import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let builds = 0;
let failNext = false;
vi.mock("./libraryIndex", () => ({
  buildLibraryIndex: vi.fn(async () => {
    if (failNext) {
      failNext = false;
      throw new Error("Jellyfin muet");
    }
    builds++;
    return { byKey: new Map(), entries: [], build: builds };
  }),
}));

import {
  getLibraryIndexMemo,
  refreshLibraryMemo,
  resetLibraryMemoForTests,
  sweepLibraryMemo,
} from "./libraryMemo";

const buildOf = (index: unknown) => (index as { build: number }).build;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
  builds = 0;
  failNext = false;
  resetLibraryMemoForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mémo de bibliothèque", () => {
  it("construit une fois, sert le même index dix minutes", async () => {
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(1);
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(1);
    expect(builds).toBe(1);
  });

  it("au-delà de dix minutes : l'ancien tout de suite, le neuf en fond", async () => {
    await getLibraryIndexMemo("u1");
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(2);
  });

  it("le rafraîchissement demandé est débouncé et ne retire jamais l'index", async () => {
    await getLibraryIndexMemo("u1");
    refreshLibraryMemo("u1");
    refreshLibraryMemo("u1");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(1);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(builds).toBe(2);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(2);
  });

  it("un scan en échec laisse l'ancien index en place", async () => {
    await getLibraryIndexMemo("u1");
    failNext = true;
    refreshLibraryMemo("u1");
    await vi.advanceTimersByTimeAsync(11_000);
    expect(buildOf(await getLibraryIndexMemo("u1"))).toBe(1);
  });

  it("le balayage retire les index non lus depuis un jour", async () => {
    await getLibraryIndexMemo("u1");
    await getLibraryIndexMemo("u2");
    await vi.advanceTimersByTimeAsync(20 * 3600_000);
    await getLibraryIndexMemo("u2");
    await vi.advanceTimersByTimeAsync(5 * 3600_000);
    expect(sweepLibraryMemo()).toBe(1);
    expect(builds).toBe(3);
    await getLibraryIndexMemo("u1");
    expect(builds).toBe(4);
  });
});
