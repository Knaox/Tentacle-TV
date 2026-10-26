/**
 * La houle suit l'énergie de la musique : la règle pure (niveau → énergie lissée → facteur borné), le relevé
 * partagé (rien sans houle qui roule, rien sans source), et l'application aux animations d'une houle.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../desktop/bridge", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/capabilities", () => ({ supportsAudioLevel: () => false }));

const { ENERGY_START, ENERGY_TUNING, NEUTRAL_DRIVE, NEUTRAL_ENERGY, driveChanged, driveOf, newTrack, stepEnergy, swellAmplitude, swellRate } = await import("./oceanEnergy");
const { LEVEL_POLL_MS, createEnergyStore, oceanEnergy } = await import("./oceanEnergyStore");
const { OCEAN_ANIMATIONS, applyDrive } = await import("./useOceanEnergy");

type State = typeof ENERGY_START;
const STEP = 200;

/** Rejoue des niveaux (une valeur, ou une fonction du temps en ms) pendant `ms`, par pas de 200 ms. */
function play(level: number | null | ((t: number) => number), ms: number, from: State = ENERGY_START): State {
  let s = from;
  for (let t = 0; t < ms; t += STEP) s = stepEnergy(s, typeof level === "function" ? level(t) : level, STEP);
  return s;
}
/** Un titre qui ondule doucement autour de `base` (± 2 dB, période 4 s). */
const wobble = (base: number) => (t: number) => base + 2 * Math.sin((2 * Math.PI * t) / 4_000);

describe("la règle de l'énergie", () => {
  it("l'énergie neutre donne exactement l'allure de toujours", () => {
    expect(swellRate(NEUTRAL_ENERGY)).toBe(1);
    expect(driveOf(NEUTRAL_ENERGY).rate).toBe(1);
  });

  it("vitesse de 0,5× à 2,5×, amplitude de 0,7× à 1,5×, bornées quoi qu'il arrive", () => {
    expect([swellRate(-1), swellRate(0), swellRate(1), swellRate(4)]).toEqual([0.5, 0.5, 2.5, 2.5]);
    expect([swellAmplitude(-1), swellAmplitude(0), swellAmplitude(1), swellAmplitude(4)]).toEqual([0.7, 0.7, 1.5, 1.5]);
    expect(ENERGY_TUNING.minRate).toBe(0.5);
    expect(ENERGY_TUNING.maxRate).toBe(2.5);
  });

  it("normalisée sur le titre : un morceau doux et un morceau fort ont les mêmes pics pour le même élan", () => {
    const quiet = play(-34, 12_000);
    const loud = play(-12, 12_000, newTrack(quiet));
    const quietPeak = swellRate(play(-26, 600, quiet).energy);
    const loudPeak = swellRate(play(-4, 600, loud).energy);
    expect(quietPeak).toBeGreaterThan(2);
    expect(loudPeak).toBeGreaterThan(2);
    expect(Math.abs(quietPeak - loudPeak)).toBeLessThan(0.45);
  });

  it("un titre installé roule à son allure habituelle, et ses creux et ses pics se SENTENT", () => {
    const settled = play(wobble(-20), 20_000);
    expect(swellRate(settled.energy)).toBeGreaterThan(0.75);
    expect(swellRate(settled.energy)).toBeLessThan(1.45);
    const drop = play(-11, 400, settled);
    expect(swellRate(drop.energy)).toBeGreaterThan(2);
    const breakdown = play(-30, 3_000, settled);
    expect(swellRate(breakdown.energy)).toBeLessThan(0.7);
  });

  it("attaque rapide (~0,2 s), relâchement plus lent (~1 s)", () => {
    const settled = play(-20, 20_000);
    const base = settled.energy;
    const hit = play(-10, 200, settled);
    expect((hit.energy - base) / (1 - base)).toBeGreaterThan(0.5);
    const top = play(-10, 1_000, settled);
    const released = play(-20, 200, top);
    expect((top.energy - released.energy) / (top.energy - base)).toBeLessThan(0.3);
    expect(play(-20, 3_000, top).energy - base).toBeLessThan(0.1);
  });

  it("un nouveau titre a sa propre moyenne, sans retombée de l'énergie au raccord", () => {
    const s = play(-12, 12_000);
    const next = newTrack(s);
    expect(next.meanDb).toBeNull();
    expect(next.energy).toBe(s.energy);
  });

  it("sans mesure (null, NaN), l'état ne bouge pas ; un silence ne tire pas la moyenne du titre", () => {
    const s = play(-20, 10_000);
    expect(stepEnergy(s, null, STEP)).toBe(s);
    expect(stepEnergy(s, Number.NaN, STEP)).toBe(s);
    expect(play(-120, 5_000, s).meanDb).toBe(s.meanDb);
    expect(swellRate(play(-120, 3_000, s).energy)).toBeLessThan(0.6);
  });

  it("un écart de temps aberrant compte pour deux secondes au plus", () => {
    const calm = play(-30, 20_000);
    expect(stepEnergy(calm, -8, 600_000)).toEqual(stepEnergy(calm, -8, 2_000));
  });

  it("on ne pousse qu'un changement qui compte", () => {
    expect(driveChanged({ rate: 1, amplitude: 1 }, { rate: 1.02, amplitude: 1.01 })).toBe(false);
    expect(driveChanged({ rate: 1, amplitude: 1 }, { rate: 1.04, amplitude: 1 })).toBe(true);
    expect(driveChanged({ rate: 2, amplitude: 1 }, { rate: 2.05, amplitude: 1 })).toBe(false);
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
    expect(read.mock.calls.length).toBe(50);
    const last = a.mock.calls.at(-1)?.[0];
    expect(last.rate).toBeGreaterThan(1);
    expect(b.mock.calls.at(-1)?.[0]).toEqual(last);
    offA();
    expect(f.running()).toBe(1);
    offB();
    expect(f.running()).toBe(0);
    await f.advance(2_000);
    expect(read.mock.calls.length).toBe(50);
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

describe("entre deux titres", () => {
  it("la houle qui change de rangée garde son énergie ; partie longtemps, elle repart de l'allure de toujours", async () => {
    const { ENERGY_GRACE_MS } = await import("./oceanEnergyStore");
    const f = fakeClock();
    const store = createEnergyStore(() => async () => -10, f.clock);
    const first = vi.fn();
    const off = store.subscribe(first);
    await f.advance(10_000);
    const lifted = first.mock.calls.at(-1)?.[0];
    expect(lifted.rate).toBeGreaterThan(1);
    off();
    const next = vi.fn();
    const offNext = store.subscribe(next);
    expect(next).toHaveBeenCalledWith(lifted);
    offNext();
    await f.advance(ENERGY_GRACE_MS + 500);
    const late = vi.fn();
    const offLate = store.subscribe(late);
    expect(late).toHaveBeenCalledWith(NEUTRAL_DRIVE);
    offLate();
  });
});
