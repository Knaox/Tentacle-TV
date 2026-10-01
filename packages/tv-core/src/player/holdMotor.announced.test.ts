import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHoldMotor, HOLD_ANNOUNCED_MAX_MS, HOLD_TICK_MS, SILENCE_DEFAULT_MS } from "./holdMotor";

/**
 * Le maintien ANNONCÉ — celui de la télécommande d'Apple TV : un début (l'appui
 * long reconnu), une fin, et RIEN entre les deux. Le chien de garde de silence
 * des dalles le coupait au bout de 0,7 s ; mesuré au simulateur, maintenir
 * DROITE deux secondes et demie avançait de trois minutes, puis plus rien.
 */

const RIGHT = 39;
const LEFT = 37;

function harness() {
  const ticks: Array<{ sign: 1 | -1; tier: number }> = [];
  const jumps: Array<1 | -1> = [];
  const motor = createHoldMotor({
    jump: (sign) => jumps.push(sign),
    advance: (sign, tier) => ticks.push({ sign, tier }),
  });
  return { motor, ticks, jumps };
}

describe("holdMotor — maintien annoncé", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avance tant qu'on tient, sans aucune répétition, bien au-delà du silence", () => {
    const { motor, ticks, jumps } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(4 * SILENCE_DEFAULT_MS);

    expect(ticks.length).toBe(Math.floor((4 * SILENCE_DEFAULT_MS) / HOLD_TICK_MS));
    expect(jumps).toHaveLength(0);
    motor.destroy();
  });

  it("monte d'un palier par seconde : ×1, ×2, ×4, ×8", () => {
    const { motor, ticks } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(4000);

    expect(ticks.map((t) => t.tier)).toEqual([1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    motor.destroy();
  });

  it("s'arrête net au relâchement de la touche tenue", () => {
    const { motor, ticks } = harness();

    motor.hold(LEFT, -1);
    vi.advanceTimersByTime(1100);
    motor.release(LEFT);
    const frozen = ticks.length;
    vi.advanceTimersByTime(3000);

    expect(frozen).toBe(4);
    expect(ticks).toHaveLength(frozen);
    expect(ticks.every((t) => t.sign === -1)).toBe(true);
  });

  it("le relâchement d'une autre touche ne coupe rien", () => {
    const { motor, ticks } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(500);
    motor.release(LEFT);
    vi.advanceTimersByTime(500);

    expect(ticks).toHaveLength(4);
    motor.destroy();
  });

  it("s'arrête de lui-même au plafond, si la fin s'est perdue", () => {
    const { motor, ticks } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(HOLD_ANNOUNCED_MAX_MS);
    const capped = ticks.length;
    vi.advanceTimersByTime(5000);

    expect(ticks).toHaveLength(capped);
  });

  it("un maintien annoncé repart de zéro : le palier ne s'hérite pas", () => {
    const { motor, ticks } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(3000);
    motor.release(RIGHT);
    ticks.length = 0;
    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(500);

    expect(ticks.map((t) => t.tier)).toEqual([1, 1]);
    motor.destroy();
  });

  it("annuler (confirmation, annulation du déplacement) coupe le tic", () => {
    const { motor, ticks } = harness();

    motor.hold(RIGHT, 1);
    vi.advanceTimersByTime(600);
    motor.cancel();
    const frozen = ticks.length;
    vi.advanceTimersByTime(2000);

    expect(ticks).toHaveLength(frozen);
  });
});
