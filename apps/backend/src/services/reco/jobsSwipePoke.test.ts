import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWIPE_POOL_REGEN_MIN_AGE_MS, pokeProfile } from "./jobs";

// Le poke du profil, isolé : reconstruction et génération sont des espions,
// seule compte la garde d'âge appliquée au pool après la reconstruction.
const spies = vi.hoisted(() => ({
  rebuild: vi.fn(async () => ({})),
  generate: vi.fn(async () => ({ poolSize: 1 })),
  poolAgeMin: 10,
}));

vi.mock("./profileBuilder", () => ({ rebuildProfile: spies.rebuild }));
vi.mock("./generationJob", () => ({
  generatePool: spies.generate,
  readPool: async () => ({ generatedAt: new Date(Date.now() - spies.poolAgeMin * 60_000).toISOString() }),
}));

async function flush() {
  await vi.advanceTimersByTimeAsync(8_000);
  await vi.runAllTimersAsync();
}

beforeEach(() => {
  vi.useFakeTimers();
  spies.rebuild.mockClear();
  spies.generate.mockClear();
  spies.poolAgeMin = 10;
});
afterEach(() => vi.useRealTimers());

describe("poke du profil après une séance de swipe", () => {
  it("un poke ordinaire garde la garde de 30 min : un pool de 10 min n'est pas régénéré", async () => {
    pokeProfile("u1");
    await flush();
    expect(spies.rebuild).toHaveBeenCalledTimes(1);
    expect(spies.generate).not.toHaveBeenCalled();
  });

  it("après des verdicts, la garde descend à quelques minutes : le pool se régénère", async () => {
    expect(SWIPE_POOL_REGEN_MIN_AGE_MS).toBeLessThan(10 * 60_000);
    pokeProfile("u1", { poolMinAgeMs: SWIPE_POOL_REGEN_MIN_AGE_MS });
    await flush();
    expect(spies.generate).toHaveBeenCalledTimes(1);
  });

  it("une salve de verdicts ne coûte qu'une reconstruction et qu'une génération", async () => {
    for (let i = 0; i < 12; i++) pokeProfile("u1", { poolMinAgeMs: SWIPE_POOL_REGEN_MIN_AGE_MS });
    pokeProfile("u1"); // un poke ordinaire au milieu ne rallonge pas la garde
    await flush();
    expect(spies.rebuild).toHaveBeenCalledTimes(1);
    expect(spies.generate).toHaveBeenCalledTimes(1);
  });

  it("un pool tout neuf n'est pas régénéré, même après des verdicts", async () => {
    spies.poolAgeMin = 1;
    pokeProfile("u1", { poolMinAgeMs: SWIPE_POOL_REGEN_MIN_AGE_MS });
    await flush();
    expect(spies.generate).not.toHaveBeenCalled();
  });
});
