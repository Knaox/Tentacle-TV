import { describe, expect, it } from "vitest";
import { shouldResyncStillWatching, STILL_WATCHING_RESYNC_MIN_INTERVAL_MS } from "./stillWatchingResync";

describe("shouldResyncStillWatching", () => {
  it("relit toujours tant que le serveur n'a pas prouvé le réglage — même juste après une relecture", () => {
    expect(shouldResyncStillWatching({ supported: false, lastResyncAt: 1_000, now: 1_001 })).toBe(true);
  });

  it("prouvé : une relecture par demi-minute, pas plus", () => {
    expect(shouldResyncStillWatching({ supported: true, lastResyncAt: 1_000, now: 1_000 + STILL_WATCHING_RESYNC_MIN_INTERVAL_MS - 1 })).toBe(false);
    expect(shouldResyncStillWatching({ supported: true, lastResyncAt: 1_000, now: 1_000 + STILL_WATCHING_RESYNC_MIN_INTERVAL_MS })).toBe(true);
  });
});
