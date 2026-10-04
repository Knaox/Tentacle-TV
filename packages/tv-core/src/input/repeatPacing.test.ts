import { describe, expect, it } from "vitest";
import { HOLD_IDLE, REPEAT_PACING, holdRelease, holdRepeat, holdTick, repeatInterval, type HoldPacingState } from "./repeatPacing";

const DOWN = 20; // KEYCODE_DPAD_DOWN
const RIGHT = 22;
const FRAME = 1000 / 60;

/**
 * Rejoue une flèche tenue : la 1re répétition à `firstAt`, puis toutes les
 * `every` ms jusqu'à `until` ; une image toutes les 16,7 ms. Rend les pas
 * (instant, intervalle annoncé) et l'instant où la tenue se dit finie.
 */
function hold(firstAt: number, every: number, until: number, end = until + 1_000) {
  let state: HoldPacingState = HOLD_IDLE;
  const steps: Array<{ at: number; intervalMs: number }> = [];
  let releasedAt: number | null = null;
  let nextRepeat = firstAt;
  for (let now = firstAt; now <= end && releasedAt === null; now += FRAME) {
    while (nextRepeat <= now && nextRepeat <= until) {
      state = holdRepeat(state, { key: DOWN, now: nextRepeat }).state;
      nextRepeat += every;
    }
    const tick = holdTick(state, now);
    state = tick.state;
    if (tick.step) steps.push({ at: now, intervalMs: tick.intervalMs });
    if (tick.released) releasedAt = now;
  }
  return { steps, releasedAt };
}

describe("repeatInterval — l'intervalle voulu pendant une tenue", () => {
  it("part de 160 ms et descend linéairement à 70 ms en 1,5 s", () => {
    expect(repeatInterval(0)).toBe(160);
    expect(repeatInterval(750)).toBe(115);
    expect(repeatInterval(1_500)).toBe(70);
    expect(repeatInterval(10_000)).toBe(70);
  });

  it("une rampe nulle donne le plafond tout de suite", () => {
    expect(repeatInterval(0, { ...REPEAT_PACING, rampMs: 0 })).toBe(70);
  });
});

describe("holdRepeat — les répétitions ne font jamais un pas d'elles-mêmes", () => {
  it("la première ouvre la tenue : le premier pas est dû tout de suite", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 470 });
    expect(opened).toEqual({ started: true, state: { key: DOWN, holdAt: 470, nextStepAt: 470, lastRepeatAt: 470 } });
  });

  it("les suivantes disent seulement « toujours tenue »", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 470 }).state;
    const again = holdRepeat(opened, { key: DOWN, now: 520 });
    expect(again.started).toBe(false);
    expect(again.state).toEqual({ ...opened, lastRepeatAt: 520 });
  });

  it("une autre flèche ouvre une tenue neuve", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 470 }).state;
    expect(holdRepeat(opened, { key: RIGHT, now: 600 })).toEqual({ started: true, state: { key: RIGHT, holdAt: 600, nextStepAt: 600, lastRepeatAt: 600 } });
  });
});

describe("holdTick — les pas, sur l'horloge de la tenue", () => {
  it("rien hors d'une tenue", () => {
    expect(holdTick(HOLD_IDLE, 1_000)).toEqual({ step: false, intervalMs: 0, released: true, state: HOLD_IDLE });
  });

  it("le premier pas à la première image, puis plus rien avant l'intervalle", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 470 }).state;
    const first = holdTick(opened, 470);
    expect(first.step).toBe(true);
    expect(first.intervalMs).toBe(160);
    expect(first.state.nextStepAt).toBe(630);
    expect(holdTick(first.state, 620).step).toBe(false);
  });

  it("une cadence qui accélère EN CONTINU — jamais de marche, jamais plus lente", () => {
    const { steps } = hold(470, 50, 4_000);
    const intervals = steps.map((step) => step.intervalMs);
    expect(intervals[0]).toBe(160);
    expect(intervals.at(-1)).toBe(70);
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]);
      // Aucun saut de vitesse : deux pas voisins diffèrent de moins de 10 %.
      expect(intervals[i - 1] / intervals[i]).toBeLessThan(1.1);
    }
  });

  it("à la cadence voulue en moyenne, à une image près par pas, sans dériver", () => {
    const { steps } = hold(470, 50, 4_470);
    // Au plafond, sur 2 s : 2000 / 70 ≈ 28,6 pas.
    const late = steps.filter((step) => step.at >= 2_470 && step.at < 4_470);
    expect(late.length).toBeGreaterThanOrEqual(28);
    expect(late.length).toBeLessThanOrEqual(29);
    for (let i = 1; i < late.length; i++) expect(late[i].at - late[i - 1].at).toBeLessThan(70 + FRAME);
  });

  it("une image très longue ne fait jamais deux pas de rattrapage", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 0 }).state;
    const first = holdTick(opened, 0).state; // prochain pas à 160
    const late = holdTick({ ...first, lastRepeatAt: 900 }, 900);
    expect(late.step).toBe(true);
    expect(late.state.nextStepAt).toBeGreaterThan(900);
    expect(holdTick({ ...late.state, lastRepeatAt: 900 }, 901).step).toBe(false);
  });

  it("plus aucune répétition depuis 300 ms : la tenue est finie (le relâchement est parti ailleurs)", () => {
    const { releasedAt, steps } = hold(470, 50, 1_470);
    expect(releasedAt).not.toBeNull();
    expect(releasedAt! - 1_470).toBeGreaterThan(300);
    expect(releasedAt! - 1_470).toBeLessThan(300 + 2 * FRAME);
    expect(steps.every((step) => step.at <= 1_470 + 300)).toBe(true);
  });
});

describe("holdRelease — la flèche relâchée", () => {
  it("finit la tenue ; relâcher une autre flèche n'y touche pas", () => {
    const opened = holdRepeat(HOLD_IDLE, { key: DOWN, now: 470 }).state;
    expect(holdRelease(opened, RIGHT)).toBe(opened);
    expect(holdRelease(opened, DOWN)).toBe(HOLD_IDLE);
  });
});
