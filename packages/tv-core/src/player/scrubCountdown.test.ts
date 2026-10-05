import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScrubCountdown, reportingActivity, type ScrubCountdownPolicy, type ScrubCountdownState,
} from "./scrubCountdown";
import { SCRUB_COUNTDOWN_DELAYS } from "./scrubCountdownSettings";
import { createScrubMachine } from "./scrubMachine";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Le décompte du défilement : entré en lecture, il se ferme seul au bout du
 * délai de sa politique après le dernier geste, dit seconde par seconde — par
 * défaut, la lecture repart à la cible au bout de 5 s ; entré en pause, rien
 * ne part seul.
 */

function harness(policy?: ScrubCountdownPolicy) {
  const states: Array<ScrubCountdownState | null> = [];
  const onExpire = vi.fn();
  const countdown = createScrubCountdown({
    onChange: (state) => states.push(state),
    onExpire,
    timers: TIMERS,
    readPolicy: policy ? () => policy : undefined,
  });
  const shown = () => states.at(-1) ?? null;
  return { countdown, states, onExpire, shown };
}

const RESUME_5 = { remaining: 5, total: 5, outcome: "resume" };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("entré en lecture", () => {
  it("dit 5, 4, 3, 2, 1 puis reprend au bout de 5 s", () => {
    const { countdown, states, onExpire } = harness();

    countdown.begin(false);
    expect(states).toMatchObject([RESUME_5]);
    vi.advanceTimersByTime(4000);
    expect(states.map((s) => s?.remaining)).toEqual([5, 4, 3, 2, 1]);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledWith("resume");
    expect(states.at(-1)).toBeNull();
  });

  it("un geste relance le décompte en entier", () => {
    const { countdown, onExpire, shown } = harness();

    countdown.begin(false);
    vi.advanceTimersByTime(3500);
    countdown.activity();
    expect(shown()).toMatchObject(RESUME_5);
    vi.advanceTimersByTime(4900);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("une relance dans la seconde affichée ouvre une nouvelle COURSE : la barre repart pleine sans attendre la seconde suivante", () => {
    const { countdown, states, shown } = harness();

    countdown.begin(false);
    const first = shown()!.run;
    vi.advanceTimersByTime(400);
    countdown.activity();
    // Toujours « 5 s » : l'état est republié quand même, d'une autre course.
    expect(states).toHaveLength(2);
    expect(shown()).toMatchObject(RESUME_5);
    expect(shown()!.run).not.toBe(first);
    // Les secondes d'une même course gardent sa marque.
    const second = shown()!.run;
    vi.advanceTimersByTime(1000);
    expect(shown()).toMatchObject({ remaining: 4, run: second });
  });

  it("un geste continu le tient (masqué), son relâchement repart d'un décompte entier", () => {
    const { countdown, onExpire, shown } = harness();

    countdown.begin(false);
    countdown.hold();
    expect(shown()).toBeNull();
    countdown.activity();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    countdown.release();
    expect(shown()).toMatchObject(RESUME_5);
    vi.advanceTimersByTime(5000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("la fermeture (OK, Retour) arrête tout", () => {
    const { countdown, onExpire, shown } = harness();

    countdown.begin(false);
    vi.advanceTimersByTime(2000);
    countdown.end();
    expect(shown()).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe("entré en pause", () => {
  it("ne dit rien et ne reprend jamais seul ; tenir et relâcher n'y changent rien", () => {
    const { countdown, states, onExpire } = harness();

    countdown.begin(true);
    countdown.hold();
    countdown.release();
    countdown.activity();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(states.every((s) => s === null)).toBe(true);
  });
});

describe("la machine qui rapporte ses gestes", () => {
  it("chaque entrée, pas et toucher relance le décompte au même instant", () => {
    const { countdown, onExpire, shown } = harness();
    const machine = reportingActivity(createScrubMachine({
      readPosition: () => 100, readDuration: () => 3000, readPaused: () => false, idleCancelMs: null,
      onEnter: () => countdown.begin(false), onChange: () => {}, onPause: () => {}, onSeek: () => {}, onExit: () => countdown.end(),
    }), countdown);

    machine.enter();
    vi.advanceTimersByTime(4500);
    machine.step(1, 1);
    expect(shown()).toMatchObject(RESUME_5);
    vi.advanceTimersByTime(4500);
    machine.touch();
    vi.advanceTimersByTime(4999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    machine.destroy();
  });
});

describe("la politique : l'issue et le délai", () => {
  const cases = (["return", "resume"] as const).flatMap((outcome) =>
    SCRUB_COUNTDOWN_DELAYS.map((seconds) => ({ outcome, seconds })));

  it.each(cases)("$outcome au bout de $seconds s : dit chaque seconde, puis rend son issue", ({ outcome, seconds }) => {
    const { countdown, states, onExpire } = harness({ outcome, delayMs: seconds * 1000 });

    countdown.begin(false);
    expect(states[0]).toMatchObject({ remaining: seconds, total: seconds, outcome });
    vi.advanceTimersByTime(seconds * 1000 - 1);
    expect(states.map((s) => s?.remaining)).toEqual(Array.from({ length: seconds }, (_, i) => seconds - i));
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith(outcome);
    expect(states.at(-1)).toBeNull();
  });

  it.each(cases)("$outcome, $seconds s : un geste relance le décompte entier, un geste continu le tient", ({ outcome, seconds }) => {
    const { countdown, onExpire, shown } = harness({ outcome, delayMs: seconds * 1000 });

    countdown.begin(false);
    vi.advanceTimersByTime(seconds * 1000 - 500);
    countdown.activity();
    expect(shown()).toMatchObject({ remaining: seconds, total: seconds, outcome });
    vi.advanceTimersByTime(seconds * 1000 - 1);
    countdown.hold();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    countdown.release();
    vi.advanceTimersByTime(seconds * 1000 - 1);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledWith(outcome);
  });

  it.each(cases)("$outcome, $seconds s : entré en pause, rien ne part ni ne se dit", ({ outcome, seconds }) => {
    const { countdown, states, onExpire } = harness({ outcome, delayMs: seconds * 1000 });

    countdown.begin(true);
    countdown.activity();
    countdown.hold();
    countdown.release();
    vi.advanceTimersByTime(120_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(states.every((s) => s === null)).toBe(true);
  });

  it("la politique se lit à l'ouverture : un réglage changé vaut au défilement suivant, pas au milieu", () => {
    let policy: ScrubCountdownPolicy = { outcome: "resume", delayMs: 10_000 };
    const onExpire = vi.fn();
    const states: Array<ScrubCountdownState | null> = [];
    const countdown = createScrubCountdown({
      onChange: (state) => states.push(state), onExpire, timers: TIMERS, readPolicy: () => policy,
    });

    countdown.begin(false);
    policy = { outcome: "return", delayMs: 3000 };
    countdown.activity();
    expect(states.at(-1)).toMatchObject({ remaining: 10, total: 10, outcome: "resume" });
    vi.advanceTimersByTime(10_000);
    expect(onExpire).toHaveBeenLastCalledWith("resume");

    countdown.begin(false);
    expect(states.at(-1)).toMatchObject({ remaining: 3, total: 3, outcome: "return" });
    vi.advanceTimersByTime(3000);
    expect(onExpire).toHaveBeenLastCalledWith("return");
  });
});
