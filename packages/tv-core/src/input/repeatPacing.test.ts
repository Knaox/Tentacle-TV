import { describe, expect, it } from "vitest";
import { REPEAT_IDLE, REPEAT_PACING, paceArrow, releaseArrow, repeatInterval, type RepeatPacingState } from "./repeatPacing";

const DOWN = 20; // KEYCODE_DPAD_DOWN
const RIGHT = 22;

/** Rejoue une flèche tenue : l'appui à `t0`, une répétition tous les `every` ms après `firstAfter`. */
function hold(key: number, t0: number, firstAfter: number, every: number, until: number) {
  let state: RepeatPacingState = REPEAT_IDLE;
  const steps: Array<{ at: number; intervalMs: number; burst: boolean }> = [];
  const press = (now: number, repeat: boolean) => {
    const decision = paceArrow(state, { key, repeat, now });
    state = decision.state;
    if (decision.accept) steps.push({ at: now, intervalMs: decision.intervalMs, burst: decision.burst });
  };
  press(t0, false);
  for (let now = t0 + firstAfter; now <= until; now += every) press(now, true);
  return { steps, state };
}

describe("repeatInterval — l'intervalle voulu pendant une rafale", () => {
  it("part de 160 ms et descend linéairement à 60 ms en 1,5 s", () => {
    expect(repeatInterval(0)).toBe(160);
    expect(repeatInterval(750)).toBe(110);
    expect(repeatInterval(1_500)).toBe(60);
    expect(repeatInterval(10_000)).toBe(60);
  });

  it("une rampe nulle donne le plafond tout de suite", () => {
    expect(repeatInterval(0, { ...REPEAT_PACING, rampMs: 0 })).toBe(60);
  });
});

describe("paceArrow — le focus sous une flèche maintenue", () => {
  it("le premier appui passe toujours, hors rafale", () => {
    const decision = paceArrow(REPEAT_IDLE, { key: DOWN, repeat: false, now: 1_000 });
    expect(decision).toEqual({ accept: true, burst: false, intervalMs: 0, state: { key: DOWN, burstAt: 0, lastStepAt: 1_000 } });
  });

  it("la première répétition (~470 ms après l'appui) passe et ouvre la rafale", () => {
    const pressed = paceArrow(REPEAT_IDLE, { key: DOWN, repeat: false, now: 1_000 }).state;
    const first = paceArrow(pressed, { key: DOWN, repeat: true, now: 1_470 });
    expect(first.accept).toBe(true);
    expect(first.burst).toBe(true);
    expect(first.intervalMs).toBe(470);
    expect(first.state.burstAt).toBe(1_470);
  });

  it("des répétitions toutes les 50 ms : un pas sur trois au début, puis un sur deux, puis chacune", () => {
    const { steps } = hold(DOWN, 0, 470, 50, 3_470);
    const intervals = steps.slice(2).map((step) => step.intervalMs);
    // Début de rafale : 150 ms (160 au jeu de 12 près, au multiple de 50).
    expect(intervals.slice(0, 2)).toEqual([150, 150]);
    // Au plafond : chaque répétition.
    expect(intervals.slice(-5)).toEqual([50, 50, 50, 50, 50]);
    // Ça n'accélère que : jamais un intervalle plus long que le précédent.
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]);
  });

  it("une répétition trop tôt est absorbée : le focus ne bouge pas, l'état ne change pas", () => {
    const pressed = paceArrow(REPEAT_IDLE, { key: DOWN, repeat: false, now: 0 }).state;
    const first = paceArrow(pressed, { key: DOWN, repeat: true, now: 470 }).state;
    const early = paceArrow(first, { key: DOWN, repeat: true, now: 520 });
    expect(early.accept).toBe(false);
    expect(early.burst).toBe(true);
    expect(early.state).toBe(first);
  });

  it("le jeu de la plateforme : à 160 ms voulues, une répétition à 148 ms passe (160 − 12)", () => {
    const flat = { ...REPEAT_PACING, rampMs: 1e9 };
    const first = { key: DOWN, burstAt: 470, lastStepAt: 470 };
    expect(paceArrow(first, { key: DOWN, repeat: true, now: 470 + 147 }, flat).accept).toBe(false);
    expect(paceArrow(first, { key: DOWN, repeat: true, now: 470 + 148 }, flat).accept).toBe(true);
  });

  it("une autre flèche, même répétée, repart d'un appui neuf", () => {
    const burst = { key: DOWN, burstAt: 470, lastStepAt: 1_000 };
    const other = paceArrow(burst, { key: RIGHT, repeat: true, now: 1_010 });
    expect(other.accept).toBe(true);
    expect(other.burst).toBe(false);
    expect(other.state).toEqual({ key: RIGHT, burstAt: 0, lastStepAt: 1_010 });
  });

  it("relâcher finit la rafale ; relâcher une autre flèche n'y touche pas", () => {
    const burst = { key: DOWN, burstAt: 470, lastStepAt: 1_000 };
    expect(releaseArrow(burst, RIGHT)).toBe(burst);
    expect(releaseArrow(burst, DOWN)).toBe(REPEAT_IDLE);
  });

  it("des appuis rapprochés mais distincts ne sont jamais absorbés", () => {
    let state: RepeatPacingState = REPEAT_IDLE;
    for (let now = 0; now < 500; now += 40) {
      const decision = paceArrow(state, { key: DOWN, repeat: false, now });
      expect(decision.accept).toBe(true);
      state = releaseArrow(decision.state, DOWN);
    }
  });
});
