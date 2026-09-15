import { describe, expect, it } from "vitest";
import { createPositionClock, POSITION_CLOCK_MAX_EXTRAPOLATION_S } from "./mpvPositionClock";

const T0 = 1_700_000_000_000;

describe("createPositionClock", () => {
  it("extrapole entre deux time-pos à la vitesse courante", () => {
    const clock = createPositionClock();
    clock.push(10, T0, 1);
    expect(clock.estimate(T0 + 100)).toBeCloseTo(10.1, 3);
    clock.push(10.125, T0 + 125, 1);
    expect(clock.estimate(T0 + 200)).toBeCloseTo(10.2, 3);
  });

  it("la médiane de trois bases absorbe la gigue d'un échantillon", () => {
    const clock = createPositionClock();
    clock.push(10, T0, 1);
    clock.push(10.125, T0 + 145, 1);   // lu 20 ms en retard : base fausse de 20 ms
    clock.push(10.25, T0 + 250, 1);
    expect(clock.estimate(T0 + 300)).toBeCloseTo(10.3, 3);
  });

  it("suit la vitesse, et repart de zéro quand elle change", () => {
    const clock = createPositionClock();
    clock.push(10, T0, 1);
    clock.push(10.125, T0 + 125, 1);
    clock.push(10.25, T0 + 250, 1.05);
    expect(clock.estimate(T0 + 250 + 1_000)).toBeCloseTo(10.25 + 0.4 * 1.05, 3);
    clock.push(10.25 + 0.125 * 1.05, T0 + 375, 1.05);
    expect(clock.estimate(T0 + 475)).toBeCloseTo(10.25 + 0.225 * 1.05, 3);
  });

  it("plafonne l'extrapolation et ne recule jamais", () => {
    const clock = createPositionClock();
    clock.push(10, T0, 1);
    expect(clock.estimate(T0 + 5_000)).toBeCloseTo(10 + POSITION_CLOCK_MAX_EXTRAPOLATION_S, 3);
    expect(clock.estimate(T0 - 500)).toBeCloseTo(10, 3);
  });

  it("null sans échantillon, et après remise à zéro", () => {
    const clock = createPositionClock();
    expect(clock.estimate(T0)).toBeNull();
    clock.push(10, T0, 1);
    clock.reset();
    expect(clock.estimate(T0)).toBeNull();
  });
});
