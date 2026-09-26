/**
 * Le redémarrage d'un module serveur de plugin : il laisse partir la réponse,
 * n'interrompt pas une opération en vol, ne se programme qu'une fois, et ne
 * se laisse pas retenir par un arrêt propre qui traîne.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRestartCoordinator, type RestartTimings } from "./pluginRestart";

const TIMINGS: RestartTimings = { exitDelayMs: 1000, maxWaitMs: 10_000, shutdownTimeoutMs: 3000, pollMs: 250 };

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

  it("tente l'arrêt propre avant de sortir", async () => {
    const order: string[] = [];
    const restart = createRestartCoordinator(() => order.push("exit"), TIMINGS);
    restart.setShutdown(async () => {
      order.push("shutdown");
    });
    restart.request("installé");
    await vi.advanceTimersByTimeAsync(TIMINGS.exitDelayMs);
    expect(order).toEqual(["shutdown", "exit"]);
  });

  it("un arrêt propre qui ne rend pas la main ne retient pas le redémarrage", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    restart.setShutdown(() => new Promise(() => {}));
    restart.request("installé");
    await vi.advanceTimersByTimeAsync(TIMINGS.exitDelayMs + TIMINGS.shutdownTimeoutMs - 1);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("un arrêt propre en échec n'empêche pas la sortie", async () => {
    const exit = vi.fn();
    const restart = createRestartCoordinator(exit, TIMINGS);
    restart.setShutdown(async () => {
      throw new Error("close failed");
    });
    restart.request("installé");
    await vi.advanceTimersByTimeAsync(TIMINGS.exitDelayMs);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
