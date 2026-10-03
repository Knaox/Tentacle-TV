import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScrubCountdown, reportingActivity, type ScrubCountdownState } from "./scrubCountdown";
import { createScrubMachine } from "./scrubMachine";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Le décompte de validation du défilement : entré en lecture, la lecture
 * repart seule à la cible 5 s après le dernier geste, dit seconde par seconde ;
 * entré en pause, rien ne part seul.
 */

function harness() {
  const states: Array<ScrubCountdownState | null> = [];
  const onResume = vi.fn();
  const countdown = createScrubCountdown({ onChange: (state) => states.push(state), onResume, timers: TIMERS });
  const shown = () => states.at(-1) ?? null;
  return { countdown, states, onResume, shown };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("entré en lecture", () => {
  it("dit 5, 4, 3, 2, 1 puis reprend au bout de 5 s", () => {
    const { countdown, states, onResume } = harness();

    countdown.begin(false);
    expect(states).toEqual([{ remaining: 5, total: 5 }]);
    vi.advanceTimersByTime(4000);
    expect(states.map((s) => s?.remaining)).toEqual([5, 4, 3, 2, 1]);
    expect(onResume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBeNull();
  });

  it("un geste relance le décompte en entier", () => {
    const { countdown, onResume, shown } = harness();

    countdown.begin(false);
    vi.advanceTimersByTime(3500);
    countdown.activity();
    expect(shown()).toEqual({ remaining: 5, total: 5 });
    vi.advanceTimersByTime(4900);
    expect(onResume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("un geste continu le tient (masqué), son relâchement repart d'un décompte entier", () => {
    const { countdown, onResume, shown } = harness();

    countdown.begin(false);
    countdown.hold();
    expect(shown()).toBeNull();
    countdown.activity();
    vi.advanceTimersByTime(60_000);
    expect(onResume).not.toHaveBeenCalled();
    countdown.release();
    expect(shown()).toEqual({ remaining: 5, total: 5 });
    vi.advanceTimersByTime(5000);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("la fermeture (OK, Retour) arrête tout", () => {
    const { countdown, onResume, shown } = harness();

    countdown.begin(false);
    vi.advanceTimersByTime(2000);
    countdown.end();
    expect(shown()).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(onResume).not.toHaveBeenCalled();
  });
});

describe("entré en pause", () => {
  it("ne dit rien et ne reprend jamais seul ; tenir et relâcher n'y changent rien", () => {
    const { countdown, states, onResume } = harness();

    countdown.begin(true);
    countdown.hold();
    countdown.release();
    countdown.activity();
    vi.advanceTimersByTime(60_000);
    expect(onResume).not.toHaveBeenCalled();
    expect(states.every((s) => s === null)).toBe(true);
  });
});

describe("la machine qui rapporte ses gestes", () => {
  it("chaque entrée, pas et toucher relance le décompte au même instant", () => {
    const { countdown, onResume, shown } = harness();
    const machine = reportingActivity(createScrubMachine({
      readPosition: () => 100, readDuration: () => 3000, readPaused: () => false, idleCancelMs: null,
      onEnter: () => countdown.begin(false), onChange: () => {}, onPause: () => {}, onSeek: () => {}, onExit: () => countdown.end(),
    }), countdown);

    machine.enter();
    vi.advanceTimersByTime(4500);
    machine.step(1, 1);
    expect(shown()).toEqual({ remaining: 5, total: 5 });
    vi.advanceTimersByTime(4500);
    machine.touch();
    vi.advanceTimersByTime(4999);
    expect(onResume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onResume).toHaveBeenCalledTimes(1);
    machine.destroy();
  });
});
