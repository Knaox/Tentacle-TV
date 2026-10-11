/**
 * Le redémarrage d'un module serveur de plugin : il laisse partir la réponse,
 * n'interrompt pas une opération en vol et ne se programme qu'une fois. L'arrêt
 * propre borné qui suit est celui du serveur (`lifecycle/serverShutdown.test.ts`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRestartCoordinator, type RestartTimings } from "./pluginRestart";

const TIMINGS: RestartTimings = { exitDelayMs: 1000, maxWaitMs: 10_000, pollMs: 250 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createRestartCoordinator", () => {
  it("sort après le délai qui laisse partir la réponse, pas avant", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    restart.request("installé");
    expect(restart.isPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith("installé");
  });

  it("attend la fin d'une opération en vol avant de sortir", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    const end = restart.beginOperation();
    restart.request("mis à jour");
    await vi.advanceTimersByTimeAsync(5000);
    expect(exit).not.toHaveBeenCalled();
    end();
    await vi.advanceTimersByTimeAsync(TIMINGS.pollMs);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("sort quand même passé le plafond d'attente", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    restart.beginOperation();
    restart.request("désinstallé");
    await vi.advanceTimersByTimeAsync(TIMINGS.maxWaitMs + TIMINGS.pollMs);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("ne programme qu'un redémarrage, même demandé deux fois", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    restart.request("un");
    restart.request("deux");
    await vi.advanceTimersByTimeAsync(5000);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("une fin d'opération appelée deux fois ne compte qu'une fois", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    const first = restart.beginOperation();
    restart.beginOperation();
    first();
    first();
    restart.request("installé");
    await vi.advanceTimersByTimeAsync(5000);
    // La seconde opération court toujours : rien ne sort.
    expect(exit).not.toHaveBeenCalled();
  });
});
