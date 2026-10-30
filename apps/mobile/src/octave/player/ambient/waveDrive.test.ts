import { describe, expect, it } from "vitest";
import { NEUTRAL_ENERGY } from "@tentacle-tv/shared/octave";
import { WAVE_CALM, WAVE_START, stepWave, waveMotion, waveNewTrack, wavePath, WAVE_POINTS } from "./waveDrive";

/** Rejoue une suite de niveaux mesurés tous les 100 ms. */
function play(levels: readonly (number | null)[], from = WAVE_START) {
  return levels.reduce((state, level) => stepWave(state, level, 100), from);
}

describe("la vague suit le niveau réel du son", () => {
  it("sans mesure, rien ne bouge (aucune énergie inventée)", () => {
    expect(play([null, null, null])).toEqual(WAVE_START);
    expect(WAVE_START.energy.energy).toBeCloseTo(NEUTRAL_ENERGY, 5);
  });

  it("un coup au-dessus du niveau du moment fait une impulsion, qui retombe vite", () => {
    const steady = play(Array(30).fill(-20));
    expect(steady.punch).toBeLessThan(0.05);
    const hit = stepWave(steady, -12, 100);
    expect(hit.punch).toBeGreaterThan(0.7);
    const after = play(Array(6).fill(-20), hit);
    expect(after.punch).toBeLessThan(0.2);
  });

  it("une montée d'intensité fait monter l'énergie, un passage doux la fait redescendre", () => {
    const quiet = play(Array(50).fill(-30));
    const loud = play(Array(10).fill(-14), quiet);
    expect(loud.energy.energy).toBeGreaterThan(quiet.energy.energy + 0.2);
    expect(waveMotion(loud.energy.energy, 0).speed).toBeGreaterThan(waveMotion(quiet.energy.energy, 0).speed);
  });

  it("un silence ne fait pas d'impulsion", () => {
    const steady = play(Array(10).fill(-20));
    expect(stepWave(steady, -120, 100).punch).toBeLessThanOrEqual(steady.punch);
  });

  it("un nouveau titre repart sur sa propre moyenne, sans retombée au raccord", () => {
    const state = play(Array(20).fill(-15));
    const next = waveNewTrack(state);
    expect(next.energy.meanDb).toBeNull();
    expect(next.energy.energy).toBe(state.energy.energy);
  });

  it("l'allure reste bornée ; le calme est plus bas que toute allure mesurée pleine", () => {
    const max = waveMotion(1, 1);
    expect(max.height).toBeLessThanOrEqual(1);
    expect(WAVE_CALM.height).toBeLessThan(waveMotion(0.5, 0.5).height);
  });
});

describe("le tracé", () => {
  it("part et finit sur la ligne médiane (enveloppe nulle aux bords), reste dans la bande", () => {
    const d = wavePath(300, 100, 1.2, 1, 2, 0, false);
    const points = d.slice(1).split("L").map((p) => p.split(" ").map(Number));
    expect(points).toHaveLength(WAVE_POINTS + 1);
    expect(points[0]).toEqual([0, 50]);
    expect(points[WAVE_POINTS]![1]).toBeCloseTo(50, 0);
    for (const [, y] of points) expect(y! >= 0 && y! <= 100).toBe(true);
  });

  it("fermée : le voile descend jusqu'au bas de la bande", () => {
    expect(wavePath(300, 100, 0, 0.5, 2, 0, true).endsWith("L300.0 100.0L0 100.0Z")).toBe(true);
  });
});

describe("l'allure", () => {
  it("vitesse = celle de la houle du bureau ; sans mesure, le calme", async () => {
    const { swellRate } = await import("@tentacle-tv/shared/octave");
    expect(waveMotion(0.7, 0).speed).toBeCloseTo(1.4 * swellRate(0.7), 1);
    expect(waveMotion(0.9, 1, 0)).toEqual(WAVE_CALM);
  });
});
