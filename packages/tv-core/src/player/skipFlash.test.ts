import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSkipFlash, SKIP_BADGE_MS, type SkipFlashState } from "./skipFlash";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function harness() {
  const states: Array<SkipFlashState | null> = [];
  const badge = createSkipFlash({ onChange: (state) => states.push(state), timers: TIMERS });
  return { badge, deltas: () => states.map((s) => s?.delta ?? null) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("le badge des sauts", () => {
  it("cumule dans le même sens tant qu'on ré-appuie dans la fenêtre", () => {
    const { badge, deltas } = harness();

    badge.flash(30);
    vi.advanceTimersByTime(900);
    badge.flash(30);
    vi.advanceTimersByTime(SKIP_BADGE_MS - 1);
    badge.flash(30);
    expect(deltas()).toEqual([30, 60, 90]);
  });

  it("repart du delta seul en sens opposé", () => {
    const { badge, deltas } = harness();

    badge.flash(-10);
    badge.flash(-10);
    badge.flash(30);
    badge.flash(-10);
    expect(deltas()).toEqual([-10, -20, 30, -10]);
  });

  it("s'efface 1,5 s après le DERNIER saut, et le cumul repart de zéro", () => {
    const { badge, deltas } = harness();

    badge.flash(30);
    vi.advanceTimersByTime(1000);
    badge.flash(30);
    vi.advanceTimersByTime(SKIP_BADGE_MS - 1);
    expect(deltas()).toEqual([30, 60]);
    vi.advanceTimersByTime(1);
    expect(deltas()).toEqual([30, 60, null]);
    badge.flash(30);
    expect(deltas()).toEqual([30, 60, null, 30]);
  });

  it("change d'identifiant à chaque saut", () => {
    const states: Array<SkipFlashState | null> = [];
    const badge = createSkipFlash({ onChange: (s) => states.push(s), timers: TIMERS });
    badge.flash(30);
    vi.advanceTimersByTime(10);
    badge.flash(30);
    expect(states[0]?.id).not.toBe(states[1]?.id);
  });

  it("détruit, ne s'efface plus (démontage)", () => {
    const { badge, deltas } = harness();

    badge.flash(30);
    badge.destroy();
    vi.advanceTimersByTime(10_000);
    expect(deltas()).toEqual([30]);
  });
});
