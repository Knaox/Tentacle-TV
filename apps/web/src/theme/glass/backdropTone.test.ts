import { describe, expect, it, vi } from "vitest";
import {
  createToneScheduler,
  nextTone,
  TONE_DARK_BELOW,
  TONE_LIGHT_ABOVE,
  type ToneRect,
} from "./backdropTone";

/**
 * Le ton de ce qui est sous le verre : glyphes sombres sur un dessous clair,
 * et inversement — avec une hystérésis (pas de clignotement sur un contenu
 * moyen) et un seul appel regroupé à la coquille par intervalle.
 */

describe("nextTone", () => {
  it("clair au-dessus du seuil, sombre en dessous, inchangé entre les deux", () => {
    expect(nextTone("dark", TONE_LIGHT_ABOVE + 0.01)).toBe("light");
    expect(nextTone("light", TONE_DARK_BELOW - 0.01)).toBe("dark");
    const middle = (TONE_LIGHT_ABOVE + TONE_DARK_BELOW) / 2;
    expect(nextTone("dark", middle)).toBe("dark");
    expect(nextTone("light", middle)).toBe("light");
  });

  it("une mesure manquante ne change rien", () => {
    expect(nextTone("light", null)).toBe("light");
    expect(nextTone("dark", Number.NaN)).toBe("dark");
  });
});

function harness(values: Array<number | null>) {
  const timers: Array<{ callback: () => void; ms: number }> = [];
  let clock = 1000;
  const sampler = vi.fn(async (rects: readonly ToneRect[]) => rects.map((_, i) => values[i] ?? null));
  const scheduler = createToneScheduler({
    sampler,
    now: () => clock,
    setTimer: (callback, ms) => {
      timers.push({ callback, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  });
  const flush = async () => {
    while (timers.length > 0) {
      const timer = timers.shift();
      clock += timer?.ms ?? 0;
      timer?.callback();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return { scheduler, sampler, flush, advance: (ms: number) => (clock += ms) };
}

const rect = (x: number): ToneRect => ({ x, y: 0, width: 100, height: 40 });

describe("createToneScheduler", () => {
  it("toutes les surfaces en UN appel, et chacune reçoit son ton", async () => {
    const h = harness([0.9, 0.1]);
    const a = vi.fn();
    const b = vi.fn();
    h.scheduler.watch("a", () => rect(0), "dark", a);
    h.scheduler.watch("b", () => rect(200), "light", b);
    await h.flush();
    expect(h.sampler).toHaveBeenCalledTimes(1);
    expect(h.sampler.mock.calls[0][0]).toHaveLength(2);
    expect(a).toHaveBeenCalledWith("light");
    expect(b).toHaveBeenCalledWith("dark");
  });

  it("au plus un appel par intervalle, même sous une rafale de demandes", async () => {
    const h = harness([0.9]);
    h.scheduler.watch("a", () => rect(0), "dark", vi.fn());
    await h.flush();
    for (let i = 0; i < 10; i++) h.scheduler.request();
    await h.flush();
    expect(h.sampler).toHaveBeenCalledTimes(2);
  });

  it("une surface hors de l'écran n'est pas mesurée ; sans surface, aucun appel", async () => {
    const h = harness([0.9]);
    h.scheduler.watch("a", () => null, "dark", vi.fn());
    await h.flush();
    expect(h.sampler).not.toHaveBeenCalled();
    h.scheduler.unwatch("a");
    h.scheduler.request();
    await h.flush();
    expect(h.sampler).not.toHaveBeenCalled();
    expect(h.scheduler.size).toBe(0);
  });

  it("le même ton ne rappelle pas la surface", async () => {
    const h = harness([0.1]);
    const onTone = vi.fn();
    h.scheduler.watch("a", () => rect(0), "dark", onTone);
    await h.flush();
    expect(onTone).not.toHaveBeenCalled();
  });

  it("une capture qui échoue laisse les tons tels quels", async () => {
    const onTone = vi.fn();
    const scheduler = createToneScheduler({
      sampler: async () => {
        throw new Error("capture refusée");
      },
      now: () => 0,
      setTimer: (callback) => {
        callback();
        return 1;
      },
      clearTimer: () => undefined,
    });
    scheduler.watch("a", () => rect(0), "dark", onTone);
    await Promise.resolve();
    await Promise.resolve();
    expect(onTone).not.toHaveBeenCalled();
  });
});
