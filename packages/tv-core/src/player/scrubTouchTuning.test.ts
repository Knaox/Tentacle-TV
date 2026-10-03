import { describe, expect, it } from "vitest";
import {
  canEngage, ENGAGE_DELAY_MS, ENGAGE_PX, FAST_FULL_SWIPE_SECONDS, FLICK_PX, HIDDEN_ENGAGE_HOLD_MS, OPEN_ENGAGE_PX,
  PAD_WIDTH_PT, scrubGainFor, SLOW_FULL_SWIPE_SECONDS,
} from "./scrubTouchTuning";
import { jumpSecondsOf, RESUME_COUNTDOWN_MS, SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS } from "./seekTuning";

describe("les sauts et la validation", () => {
  it("sautent de +30 s vers l'avant et de −10 s vers l'arrière, validés en 5 s", () => {
    expect(SKIP_FORWARD_SECONDS).toBe(30);
    expect(SKIP_BACK_SECONDS).toBe(10);
    expect(jumpSecondsOf("forward")).toBe(30);
    expect(jumpSecondsOf("backward")).toBe(-10);
    expect(RESUME_COUNTDOWN_MS).toBe(5000);
  });
});

describe("l'engagement d'un glisser", () => {
  it("habillage caché : 60 points ET 600 ms de contact", () => {
    expect(canEngage("hidden", ENGAGE_PX, 0, HIDDEN_ENGAGE_HOLD_MS)).toBe(true);
    expect(canEngage("hidden", ENGAGE_PX, 0, HIDDEN_ENGAGE_HOLD_MS - 1)).toBe(false);
    expect(canEngage("hidden", ENGAGE_PX - 1, 0, 10_000)).toBe(false);
    expect(canEngage("hidden", 1000, 0, 100)).toBe(false);
  });

  it("habillage affiché : 60 points, puis 180 ms ou un geste franc de 180 points", () => {
    expect(canEngage("shown", ENGAGE_PX, 0, ENGAGE_DELAY_MS)).toBe(true);
    expect(canEngage("shown", ENGAGE_PX, 0, ENGAGE_DELAY_MS - 1)).toBe(false);
    expect(canEngage("shown", FLICK_PX, 0, 0)).toBe(true);
    expect(canEngage("shown", FLICK_PX - 1, 0, 0)).toBe(false);
  });

  it("défilement ouvert : dès 12 points, sans délai", () => {
    expect(canEngage("open", OPEN_ENGAGE_PX, 0, 0)).toBe(true);
    expect(canEngage("open", -OPEN_ENGAGE_PX, 0, 0)).toBe(true);
    expect(canEngage("open", OPEN_ENGAGE_PX - 1, 0, 0)).toBe(false);
  });

  it("refuse un glisser plus vertical que 1,4 fois l'horizontale", () => {
    expect(canEngage("open", 140, 100, 0)).toBe(true);
    expect(canEngage("open", 139, 100, 0)).toBe(false);
    expect(canEngage("shown", 300, 250, 1000)).toBe(false);
  });
});

describe("le gain du glisser", () => {
  const perPad = (speed: number) => scrubGainFor(speed) * PAD_WIDTH_PT;

  it("lent : 1 min 30 par largeur de pavé ; vif : 6 min, plafond", () => {
    expect(perPad(0)).toBeCloseTo(SLOW_FULL_SWIPE_SECONDS, 9);
    expect(perPad(PAD_WIDTH_PT)).toBeCloseTo(SLOW_FULL_SWIPE_SECONDS, 9);
    expect(perPad(4 * PAD_WIDTH_PT)).toBeCloseTo(FAST_FULL_SWIPE_SECONDS, 9);
    expect(perPad(40 * PAD_WIDTH_PT)).toBeCloseTo(FAST_FULL_SWIPE_SECONDS, 9);
  });

  it("monte en douceur entre les deux (milieu exact au milieu des vitesses)", () => {
    expect(perPad(2.5 * PAD_WIDTH_PT)).toBeCloseTo((SLOW_FULL_SWIPE_SECONDS + FAST_FULL_SWIPE_SECONDS) / 2, 9);
    let previous = 0;
    for (let speed = 0; speed <= 5 * PAD_WIDTH_PT; speed += 100) {
      const gain = scrubGainFor(speed);
      expect(gain).toBeGreaterThanOrEqual(previous);
      previous = gain;
    }
  });
});
