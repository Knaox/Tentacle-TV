import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHoldMotor,
  REPEATS_BEFORE_TICK,
  SILENCE_DEFAULT_MS,
  SILENCE_MIN_MS,
  HOLD_TICK_MS,
  type HoldMotor,
} from "./holdMotor";

/**
 * Ce qui se vérifie ici ne se voit pas à l'œil.
 *
 * Le défaut que ce module corrige — un débit qui dépendait de la cadence
 * d'auto-répétition de la dalle — ne se constate qu'en comparant deux
 * téléviseurs côte à côte. Les tests tiennent l'horloge, ce qu'aucune
 * observation ne permet.
 *
 * L'invariant central : **un appui simple n'accélère jamais**. C'est lui qui
 * évite qu'une pression un peu appuyée parte à huit fois la vitesse.
 */

const RIGHT = 39;
const LEFT = 37;
const OK = 13;

interface Step {
  at: number;
  sign: 1 | -1;
  /** Le palier du tic, ou `0` pour un saut — un geste n'accélère jamais. */
  tier: number;
  kind: "saut" | "tic";
}

function harness() {
  const from = Date.now();
  const step: Step[] = [];
  const motor = createHoldMotor({
    jump: (sign) => step.push({ at: Date.now() - from, sign, tier: 0, kind: "saut" }),
    advance: (sign, tier) => step.push({ at: Date.now() - from, sign, tier, kind: "tic" }),
  });
  return { step, motor, jumps: () => step.filter((p) => p.kind === "saut"),
    ticks: () => step.filter((p) => p.kind === "tic") };
}

/** Un maintien : un appui, puis des répétitions à `intervalle` pendant `duree`. */
function hold(motor: HoldMotor, code: number, sign: 1 | -1, interval: number, duration: number): void {
  motor.press(code, sign);
  for (let elapsed = interval; elapsed <= duration; elapsed += interval) {
    vi.advanceTimersByTime(interval);
    motor.press(code, sign);
  }
}

describe("holdMotor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("un appui simple est un saut sec, jamais une entrée en déplacement", () => {
    const { step, motor } = harness();

    motor.press(RIGHT, 1);

    expect(step).toEqual([{ at: 0, sign: 1, tier: 0, kind: "saut" }]);
    motor.destroy();
  });

  it("des appuis espacés restent des sauts, sans jamais accélérer", () => {
    const { step, motor, ticks } = harness();

    for (let i = 0; i < 8; i++) {
      motor.press(RIGHT, 1);
      vi.advanceTimersByTime(SILENCE_DEFAULT_MS + 50);
    }

    expect(step).toHaveLength(8);
    expect(step.every((p) => p.kind === "saut")).toBe(true);
    expect(ticks()).toHaveLength(0);
    motor.destroy();
  });

  it("le tic possède l'avance : une dalle lente n'avance pas moins vite", () => {
    const { step, motor } = harness();

    // 400 ms entre deux répétitions, soit moins d'un appui par tic. Le débit
    // doit rester celui du tic, pas celui de la dalle.
    hold(motor, RIGHT, 1, 400, 1200);

    // À cette cadence, le tic ne prend la main qu'à la DEUXIÈME répétition — le
    // temps de distinguer une touche tenue d'un doigt qui tape. L'appui et le
    // battement d'attente sautent ; celui qui engage passe la main sans sauter,
    // pour ne pas déplacer le point d'où le curseur part.
    const engagement = 400 * REPEATS_BEFORE_TICK;
    const jumps = REPEATS_BEFORE_TICK;
    const ticks = Math.floor((1200 - engagement) / HOLD_TICK_MS);
    expect(step).toHaveLength(jumps + ticks);
    motor.destroy();
  });

  it("le palier monte d'un cran par seconde de maintien", () => {
    const { step, motor } = harness();

    // Un vrai maintien : les répétitions ne s'arrêtent pas pendant qu'on tient.
    hold(motor, RIGHT, 1, 100, 4200);

    // Le maintien s'engage à la deuxième répétition, donc à 100 ms. On lit le
    // palier au milieu de chaque seconde qui suit.
    const tierAt = (at: number) => {
      const near = step.filter((p) => p.at > 100 && p.at <= at).pop();
      return near ? near.tier : null;
    };

    expect(tierAt(600)).toBe(1);
    expect(tierAt(1600)).toBe(2);
    expect(tierAt(2600)).toBe(4);
    expect(tierAt(3600)).toBe(8);
    expect(tierAt(4200)).toBe(8);
    motor.destroy();
  });

  it("le relâchement arrête le tic sur-le-champ", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 600);
    const before = step.length;

    motor.release(RIGHT);
    vi.advanceTimersByTime(2000);

    expect(step).toHaveLength(before);
    motor.destroy();
  });

  it("le relâchement d'une AUTRE touche ne coupe pas la flèche encore tenue", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 600);
    const before = step.length;

    // On tient la flèche et l'on clique : la Magic Remote a un bouton central,
    // et son `keyup` arrivait jusqu'ici couper un maintien qui ne le regardait
    // pas.
    motor.release(OK);
    vi.advanceTimersByTime(HOLD_TICK_MS * 3);

    expect(step.length).toBeGreaterThan(before);
    motor.destroy();
  });

  it("annuler coupe le maintien sans qu'on ait à nommer la touche", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 600);
    const before = step.length;

    // Le mode du lecteur a changé sous la touche — personne n'a levé le doigt.
    motor.cancel();
    vi.advanceTimersByTime(2000);

    expect(step).toHaveLength(before);
    motor.destroy();
  });

  it("après annulation, la même touche encore tenue repart d'un appui simple", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 2500);
    motor.cancel();
    const before = step.length;

    // La répétition suivante de la MÊME pression physique : elle ne doit pas
    // reprendre à huit fois la vitesse là où le maintien s'était arrêté.
    motor.press(RIGHT, 1);

    expect(step).toHaveLength(before + 1);
    expect(step[step.length - 1].kind).toBe("saut");
    motor.destroy();
  });

  it("sans relâchement, le silence arrête le tic — la dalle n'émet pas toujours keyup", () => {
    const { step, motor } = harness();

    // Répétition lente : le seuil de silence reste celui du portage.
    hold(motor, RIGHT, 1, 400, 1200);
    const before = step.length;

    // Personne ne prévient : la touche est lâchée, les répétitions cessent.
    vi.advanceTimersByTime(SILENCE_DEFAULT_MS + 100);
    const after = step.length;
    vi.advanceTimersByTime(3000);

    expect(after).toBeGreaterThan(before);
    expect(step).toHaveLength(after);
    motor.destroy();
  });

  it("une répétition rapide resserre le seuil sous les 700 ms du portage", () => {
    const { step, motor } = harness();

    // 100 ms d'intervalle : le seuil descend au plancher d'`apps/tv`, 350 ms.
    hold(motor, RIGHT, 1, 100, 600);

    // Passé le plancher, le tic doit déjà être coupé — avec le seuil par
    // défaut il tournerait encore pendant 350 ms de plus.
    vi.advanceTimersByTime(SILENCE_MIN_MS + 60);
    const atFloor = step.length;
    vi.advanceTimersByTime(SILENCE_DEFAULT_MS);

    expect(step).toHaveLength(atFloor);
    motor.destroy();
  });

  it("changer de sens repart d'un saut", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 2500);
    const before = step.length;

    motor.press(LEFT, -1);

    expect(step).toHaveLength(before + 1);
    expect(step[step.length - 1].sign).toBe(-1);
    expect(step[step.length - 1].kind).toBe("saut");
    motor.destroy();
  });

  it("détruire coupe le tic — un lecteur démonté ne pousse plus le curseur", () => {
    const { step, motor } = harness();

    hold(motor, RIGHT, 1, 100, 600);
    motor.destroy();
    const freeze = step.length;

    vi.advanceTimersByTime(3000);

    expect(step).toHaveLength(freeze);
  });
});
