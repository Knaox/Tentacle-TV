import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHoldMotor, REPEATS_BEFORE_TICK, HOLD_TICK_MS } from "./holdMotor";

/**
 * Taper ou tenir — la distinction, et rien d'autre.
 *
 * Le module rend deux gestes très différents à partir d'un flux d'événements où
 * rien ne les déclare : on tape, c'est un saut sec ; on tient, c'est le curseur
 * fantôme qui part et accélère. Se tromper de lecture ne produit pas une erreur
 * mais un lecteur qui désobéit — une avance rapide déclenchée par deux appuis,
 * ou l'inverse, une touche tenue qui ne fait que sauter.
 *
 * Séparé des tests de cadence : ceux-là mesurent le DÉBIT une fois le maintien
 * engagé, ceux-ci décident s'il l'est.
 */

interface Step {
  at: number;
  sign: 1 | -1;
  tier: number;
  kind: "skip" | "tick";
}

function harness() {
  const from = Date.now();
  const step: Step[] = [];
  const motor = createHoldMotor({
    jump: (sign) => step.push({ at: Date.now() - from, sign, tier: 0, kind: "skip" }),
    advance: (sign, tier) => step.push({ at: Date.now() - from, sign, tier, kind: "tick" }),
  });
  return {
    step,
    motor,
    jumps: () => step.filter((p) => p.kind === "skip"),
    ticks: () => step.filter((p) => p.kind === "tick"),
  };
}

/** Un maintien : un appui, puis des répétitions à `intervalle` pendant `duree`. */
function hold(
  motor: ReturnType<typeof createHoldMotor>,
  code: number,
  sign: 1 | -1,
  interval: number,
  duration: number,
): void {
  motor.press(code, sign);
  for (let elapsed = interval; elapsed <= duration; elapsed += interval) {
    vi.advanceTimersByTime(interval);
    motor.press(code, sign);
  }
}

const RIGHT = 39;

describe("holdMotor — taper ou tenir", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("deux appuis distincts font deux sauts, même rapprochés", () => {
    const { step, motor, ticks } = harness();

    // Trois cents millisecondes : le geste de quelqu'un qui tape deux fois sur
    // la même flèche. Sous l'ancien seuil de silence (700 ms) c'était pris pour
    // une auto-répétition, et deux sauts demandés donnaient une avance rapide.
    motor.press(RIGHT, 1);
    vi.advanceTimersByTime(300);
    motor.press(RIGHT, 1);

    expect(step).toHaveLength(2);
    expect(step.every((p) => p.kind === "skip")).toBe(true);

    // Et surtout : aucun déplacement ne part derrière.
    vi.advanceTimersByTime(2000);
    expect(ticks()).toHaveLength(0);
    motor.destroy();
  });

  it("une auto-répétition, elle, engage bien le maintien", () => {
    const { step, motor } = harness();

    // Une touche tenue insiste : c'est cela qu'on reconnaît, et non une
    // cadence particulière — celle d'une dalle LG n'est pas prévisible.
    motor.press(RIGHT, 1);
    for (let i = 0; i < REPEATS_BEFORE_TICK; i++) {
      vi.advanceTimersByTime(300);
      motor.press(RIGHT, 1);
    }
    const before = step.length;

    // Le tic possède l'avance à partir d'ici.
    vi.advanceTimersByTime(HOLD_TICK_MS * 3);

    expect(step.length).toBeGreaterThan(before);
    motor.destroy();
  });

  it("une touche déclarée TENUE engage le tic, si lente que soit la dalle", () => {
    const { step, motor, jumps, ticks } = harness();

    // Cadence bien au-delà de tout seuil raisonnable. Sans le signal `repeat`,
    // chaque battement retombait en « nouvel appui » : le maintien ne donnait
    // qu'une rafale de sauts, l'habillage restait à l'écran faute d'entrer en
    // déplacement, et la position bougeait par bonds sans validation.
    motor.press(RIGHT, 1);
    vi.advanceTimersByTime(900);
    motor.press(RIGHT, 1, true);
    const before = step.length;

    vi.advanceTimersByTime(HOLD_TICK_MS * 3);

    expect(ticks().length).toBeGreaterThan(0);
    expect(step.length).toBeGreaterThan(before);
    // Le battement qui engage ne saute pas : un seul saut, celui de l'appui.
    expect(jumps()).toHaveLength(1);
    motor.destroy();
  });

  it("une dalle qui répète lentement garde son avance rapide", () => {
    const { step, motor } = harness();

    // 400 ms de cadence — le module rappelle que celle d'un téléviseur LG
    // n'est ni documentée ni constante. Un simple plafond de vitesse aurait
    // fait disparaître l'avance rapide sur ce modèle-là.
    hold(motor, RIGHT, 1, 400, 1600);
    const before = step.length;

    vi.advanceTimersByTime(HOLD_TICK_MS * 2);

    expect(step.length).toBeGreaterThan(before);
    motor.destroy();
  });

});
