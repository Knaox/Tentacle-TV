import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScrubMachine, IDLE_CANCEL_MS, type ScrubMachineOptions } from "./scrubMachine";

/**
 * L'abandon sur inactivité est réglable. Le téléviseur LG garde le filet par
 * défaut ; le lecteur d'`apps/tv` le coupe (`idleCancelMs: null`) : il ferme
 * lui-même son défilement — en lecture, la reprise à la cible au bout de son
 * décompte ; en pause, la cible attend OK ou Retour, sans limite de temps.
 */

function harness(idleCancelMs?: number | null) {
  const options: ScrubMachineOptions = {
    readPosition: () => 100,
    readDuration: () => 500,
    readPaused: () => true,
    idleCancelMs,
    onEnter: vi.fn(),
    onChange: vi.fn(),
    onPause: vi.fn(),
    onSeek: vi.fn(),
    onExit: vi.fn(),
  };
  return { options, machine: createScrubMachine(options) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("l'abandon sur inactivité", () => {
  it("tombe par défaut au bout de sept secondes", () => {
    const { machine } = harness();

    machine.step(1, 1);
    vi.advanceTimersByTime(IDLE_CANCEL_MS + 100);

    expect(machine.isActive()).toBe(false);
    machine.destroy();
  });

  it("suit le délai demandé", () => {
    const { machine } = harness(2000);

    machine.enter();
    vi.advanceTimersByTime(1900);
    expect(machine.isActive()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(machine.isActive()).toBe(false);
    machine.destroy();
  });

  it("coupé, laisse la cible jusqu'à OK, sans rien annuler en route", () => {
    const { options, machine } = harness(null);

    machine.enter();
    machine.step(1, 1);
    vi.advanceTimersByTime(10 * 60_000);

    expect(machine.isActive()).toBe(true);
    expect(options.onExit).not.toHaveBeenCalled();
    expect(options.onPause).toHaveBeenLastCalledWith(true);
    machine.confirm();
    expect(options.onSeek).toHaveBeenCalledTimes(1);
    expect(options.onPause).toHaveBeenLastCalledWith(false);
    machine.destroy();
  });

  it("coupé, Retour annule toujours et rend la pause d'avant", () => {
    const { options, machine } = harness(null);

    machine.step(1, 4);
    vi.advanceTimersByTime(60_000);
    machine.cancel();

    expect(machine.isActive()).toBe(false);
    expect(options.onSeek).not.toHaveBeenCalled();
    expect(options.onPause).toHaveBeenLastCalledWith(true);
    machine.destroy();
  });
});
