/**
 * La houle suit l'énergie de la musique : la règle pure (niveau → énergie lissée → facteur borné), le relevé
 * partagé (rien sans houle qui roule, rien sans source), et l'application aux animations d'une houle.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../desktop/bridge", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/capabilities", () => ({ supportsAudioLevel: () => false }));

const { ENERGY_START, ENERGY_TUNING, NEUTRAL_DRIVE, NEUTRAL_ENERGY, driveChanged, driveOf, stepEnergy, swellFactor } = await import("./oceanEnergy");
const { LEVEL_POLL_MS, createEnergyStore, oceanEnergy } = await import("./oceanEnergyStore");
const { OCEAN_ANIMATIONS, applyDrive } = await import("./useOceanEnergy");

/** Rejoue un niveau constant pendant `ms`, par pas de 250 ms. */
function hold(levelDb: number | null, ms: number, from = ENERGY_START) {
  let s = from;
  for (let t = 0; t < ms; t += 250) s = stepEnergy(s, levelDb, 250);
  return s;
}

describe("la règle de l'énergie", () => {
  it("l'énergie neutre donne exactement l'allure de toujours", () => {
    expect(swellFactor(NEUTRAL_ENERGY)).toBe(1);
    expect(driveOf(NEUTRAL_ENERGY)).toEqual(NEUTRAL_DRIVE);
  });

  it("bornée de 0,7× à 1,4×, quoi qu'il arrive", () => {
    expect(swellFactor(-3)).toBe(ENERGY_TUNING.minFactor);
    expect(swellFactor(0)).toBe(0.7);
    expect(swellFactor(1)).toBe(1.4);
    expect(swellFactor(9)).toBe(ENERGY_TUNING.maxFactor);
    const loud = hold(0, 60_000);
    const silent = hold(-120, 60_000);
    for (const s of [loud, silent]) {
      expect(swellFactor(s.energy)).toBeGreaterThanOrEqual(0.7);
      expect(swellFactor(s.energy)).toBeLessThanOrEqual(1.4);
    }
  });

  it("un morceau fort roule plus vite qu'un morceau doux, une fois installé", () => {
    expect(swellFactor(hold(-9, 30_000).energy)).toBeGreaterThan(swellFactor(hold(-30, 30_000).energy) + 0.2);
  });

  it("dans un même morceau, le refrain soulève la mer et le couplet la calme", () => {
    const verse = hold(-24, 30_000);
    const chorus = hold(-14, 2_000, verse);
    const backToVerse = hold(-24, 4_000, chorus);
    expect(chorus.energy).toBeGreaterThan(verse.energy + 0.2);
    expect(backToVerse.energy).toBeLessThan(chorus.energy - 0.15);
  });

  it("lissé : un coup isolé ne fait pas sauter la mer, et la descente est plus lente que la montée", () => {
    const calm = hold(-30, 30_000);
    const hit = stepEnergy(calm, -6, 250);
    expect(swellFactor(hit.energy) - swellFactor(calm.energy)).toBeLessThan(0.15);
    const up = hold(-10, 1_000, calm).energy - calm.energy;
    const high = hold(-10, 30_000, calm);
    const down = high.energy - hold(-30, 1_000, high).energy;
    expect(up).toBeGreaterThan(down);
  });

  it("sans mesure (null, NaN), l'état ne bouge pas ; un silence ne tire pas la moyenne du morceau", () => {
    const s = hold(-20, 10_000);
    expect(stepEnergy(s, null, 250)).toBe(s);
    expect(stepEnergy(s, Number.NaN, 250)).toBe(s);
    expect(hold(-120, 5_000, s).meanDb).toBe(s.meanDb);
  });

  it("un écart de temps aberrant compte pour deux secondes au plus", () => {
    const calm = hold(-30, 30_000);
    expect(stepEnergy(calm, -8, 600_000)).toEqual(stepEnergy(calm, -8, 2_000));
  });

  it("on ne pousse qu'un changement qui compte", () => {
    expect(driveChanged({ rate: 1, amplitude: 1 }, { rate: 1.01, amplitude: 1.01 })).toBe(false);
    expect(driveChanged({ rate: 1, amplitude: 1 }, { rate: 1.03, amplitude: 1 })).toBe(true);
  });
});

function fakeClock() {
  let now = 0;
  const timers = new Set<() => void>();
  return {
    clock: { now: () => now, every: (fn: () => void) => (timers.add(fn), () => timers.delete(fn)) },
    async advance(ms: number) {
      for (let t = 0; t < ms; t += LEVEL_POLL_MS) {
        now += LEVEL_POLL_MS;
        for (const fn of [...timers]) fn();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
    running: () => timers.size,
  };
}

describe("le relevé partagé", () => {
  it("sans source (le web), aucune demande : l'allure de toujours", () => {
    const seen: unknown[] = [];
    const off = oceanEnergy.subscribe((d) => seen.push(d));
    expect(oceanEnergy.polling()).toBe(false);
    expect(seen).toEqual([NEUTRAL_DRIVE]);
    off();
  });

  it("un seul relevé pour toutes les houles, arrêté quand la dernière s'en va", async () => {
    const f = fakeClock();
    const read = vi.fn(async () => -10);
    const store = createEnergyStore(() => read, f.clock);
    const a = vi.fn();
    const b = vi.fn();
    const offA = store.subscribe(a);
    const offB = store.subscribe(b);
    expect(f.running()).toBe(1);
    await f.advance(10_000);
    expect(read.mock.calls.length).toBe(40);
    const last = a.mock.calls.at(-1)?.[0];
    expect(last.rate).toBeGreaterThan(1);
    expect(b.mock.calls.at(-1)?.[0]).toEqual(last);
    offA();
    expect(f.running()).toBe(1);
    offB();
    expect(f.running()).toBe(0);
    await f.advance(2_000);
    expect(read.mock.calls.length).toBe(40);
  });

  it("une source qui échoue ou ne mesure rien (pause, mode exclusif) laisse la houle telle quelle", async () => {
    const f = fakeClock();
    const store = createEnergyStore(() => async () => {
      throw new Error("pont fermé");
    }, f.clock);
    const seen = vi.fn();
    const off = store.subscribe(seen);
    await f.advance(3_000);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(NEUTRAL_DRIVE);
    off();
  });
});

describe("appliquer à une houle", () => {
  function element(names: string[]) {
    const animations = names.map((animationName) => ({ animationName, playbackRate: 1, updatePlaybackRate: vi.fn(function (this: { playbackRate: number }, r: number) { this.playbackRate = r; }) }));
    const style = new Map<string, string>();
    const el = { style: { setProperty: (k: string, v: string) => style.set(k, v) }, getAnimations: () => animations } as unknown as HTMLElement;
    return { el, animations, style };
  }

  it("la vitesse de SES animations (temps gardé), l'amplitude par sa variable", () => {
    const { el, animations, style } = element(["ocSwellLeft", "ocOceanDriftRight", "octaveStageIn"]);
    applyDrive(el, { rate: 1.3, amplitude: 1.25 });
    expect(style.get("--ocean-amp")).toBe("1.25");
    expect(animations[0]?.updatePlaybackRate).toHaveBeenCalledWith(1.3);
    expect(animations[1]?.updatePlaybackRate).toHaveBeenCalledWith(1.3);
    expect(animations[2]?.updatePlaybackRate).not.toHaveBeenCalled();
    applyDrive(el, { rate: 1.3, amplitude: 1.2 });
    expect(animations[0]?.updatePlaybackRate).toHaveBeenCalledTimes(1);
  });

  it("toutes les animations de la feuille sont connues", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(__dirname, "oceanMotion.css"), "utf8");
    const names = Array.from(css.matchAll(/@keyframes\s+(\w+)/g), (m) => m[1] as string).filter((n) => n !== "ocOceanFade");
    expect(new Set(names)).toEqual(OCEAN_ANIMATIONS);
  });
});
