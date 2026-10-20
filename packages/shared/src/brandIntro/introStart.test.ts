import { describe, expect, it } from "vitest";
import { INTRO_START, INTRO_START_FRESH, introStartStep, type IntroStartState } from "./introStart";

const run = (frames: readonly [number, boolean][]) => {
  let state: IntroStartState = INTRO_START_FRESH;
  for (let index = 0; index < frames.length; index += 1) {
    const [elapsed, ready] = frames[index] as [number, boolean];
    const step = introStartStep(state, elapsed, ready);
    state = step.state;
    if (step.start) return { startedAt: index, state };
  }
  return { startedAt: -1, state };
};
const steady = (count: number, ready: boolean, gap = 16.7): [number, boolean][] => Array.from({ length: count }, () => [gap, ready]);

describe("quand le poulpe commence (mobile)", () => {
  it("jamais tant que l'app n'est pas prête, même sur un fil d'interface calme", () => {
    expect(run(steady(20, false)).startedAt).toBe(-1);
  });

  it("l'app prête, après quelques images régulières d'affilée", () => {
    expect(run([...steady(5, false), ...steady(10, true)]).startedAt).toBe(5 + INTRO_START.calmFrames - 1);
  });

  it("le gros montage du démarrage remet le compte à zéro : on commence APRÈS lui, pas pendant", () => {
    const frames: [number, boolean][] = [...steady(3, true), [600, true], ...steady(10, true)];
    expect(run(frames).startedAt).toBe(3 + 1 + INTRO_START.calmFrames - 1);
  });

  it("jamais plus longtemps que l'attente maximale sur l'encre, même si l'app ne se dit jamais prête", () => {
    const { startedAt, state } = run(steady(200, false));
    expect(startedAt).toBe(Math.ceil(INTRO_START.maxWaitMs / 16.7) - 1);
    expect(state.waitedMs).toBeGreaterThanOrEqual(INTRO_START.maxWaitMs);
    expect(state.periodMs).toBeCloseTo(16.7, 6);
  });

  it("à 120 Hz, le pas est celui de l'écran", () => {
    expect(run(steady(10, true, 8.3)).startedAt).toBe(INTRO_START.calmFrames - 1);
  });
});
