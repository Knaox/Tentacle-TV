import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TouchMode } from "./scrubTouchTuning";
import { createTouchScrub, FLUSH_MS, SILENT_END_MS } from "./touchScrub";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function harness(mode: TouchMode, duration = 3000) {
  const calls: string[] = [];
  let nudged = 0;
  const touch = createTouchScrub({
    readTouchMode: () => mode,
    onTouchStart: () => calls.push("touch"),
    onStartScrub: () => calls.push("start"),
    onNudgeScrub: (delta) => { nudged += delta; calls.push("nudge"); },
    onEndScrub: () => calls.push("end"),
    onWake: () => calls.push("wake"),
    readDuration: () => duration,
  }, TIMERS);
  /** Un glisser de `dx` points en `ms`, par pas de 16 ms. */
  const slide = (dx: number, ms: number, vx: number) => {
    const n = Math.round(ms / 16);
    for (let i = 1; i <= n; i++) {
      vi.advanceTimersByTime(16);
      touch.drag("move", Math.round((dx * i) / n), 0, vx);
    }
  };
  return { calls, touch, slide, nudged: () => nudged };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("le glisser au pavé", () => {
  it("habillage caché : 600 ms de contact et 60 points avant de défiler", () => {
    const h = harness("hidden");

    h.touch.drag("start", 0, 0, 0);
    h.slide(400, 1600, 250);
    h.touch.drag("end", 400, 0, 0);
    expect(h.calls[0]).toBe("touch");
    expect(h.calls).toContain("start");
    expect(h.calls.at(-1)).toBe("end");
    // ~1 largeur/s ou moins : 90 s par 1 920 points
    expect(h.nudged()).toBeGreaterThan(0);
  });

  it("habillage caché : un frôlement de 300 ms ne défile pas, il réveille", () => {
    const h = harness("hidden");

    h.touch.drag("start", 0, 0, 0);
    h.slide(200, 300, 700);
    h.touch.drag("end", 200, 0, 0);
    expect(h.calls).toEqual(["touch", "wake"]);
  });

  it("le silence d'un geste annulé le clôt au bout de 450 ms", () => {
    const h = harness("open");

    h.touch.drag("start", 0, 0, 0);
    h.slide(100, 160, 600);
    expect(h.calls).toContain("start");
    vi.advanceTimersByTime(SILENT_END_MS - 1);
    expect(h.calls.at(-1)).not.toBe("end");
    vi.advanceTimersByTime(1);
    expect(h.calls.at(-1)).toBe("end");
  });

  it("le curseur n'est redessiné que toutes les 33 ms", () => {
    const h = harness("open");

    h.touch.drag("start", 0, 0, 0);
    h.touch.drag("move", 20, 0, 500);
    h.touch.drag("move", 40, 0, 500);
    h.touch.drag("move", 60, 0, 500);
    expect(h.calls.filter((c) => c === "nudge")).toHaveLength(0);
    vi.advanceTimersByTime(FLUSH_MS);
    expect(h.calls.filter((c) => c === "nudge")).toHaveLength(1);
  });

  it("durée inconnue : rien ne défile", () => {
    const h = harness("open", 0);

    h.touch.drag("start", 0, 0, 0);
    h.slide(400, 400, 1000);
    h.touch.drag("end", 400, 0, 0);
    expect(h.calls).toEqual(["touch", "wake"]);
  });

  it("coupé (panneau ouvert), le geste en cours n'a plus de suite", () => {
    const h = harness("open");

    h.touch.drag("start", 0, 0, 0);
    h.slide(100, 160, 600);
    h.touch.reset();
    vi.advanceTimersByTime(5000);
    expect(h.calls.at(-1)).not.toBe("end");
  });
});
