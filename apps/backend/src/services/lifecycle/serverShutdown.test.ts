/**
 * L'arrêt unique du serveur : dans l'ordre, borné étape par étape, une seule
 * fois, et jamais retenu par une étape qui échoue ou ne rend pas la main.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerShutdown, shutdownSignals, type ShutdownTimings } from "./serverShutdown";

const TIMINGS: ShutdownTimings = { backgroundStopMs: 2000, httpCloseMs: 3000, databaseCloseMs: 3000 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createServerShutdown", () => {
  it("tâches de fond, HTTP, base, verrou, puis la sortie demandée", async () => {
    const order: string[] = [];
    const shutdown = createServerShutdown((code) => order.push(`exit ${code}`), TIMINGS, () => {});
    shutdown.register({
      stopBackgroundWork: () => void order.push("jobs"),
      closeHttp: async () => order.push("http"),
      closeDatabase: async () => void order.push("db"),
      releaseLock: () => void order.push("lock"),
    });
    await shutdown.run(75, "extension installée");
    expect(order).toEqual(["jobs", "http", "db", "lock", "exit 75"]);
  });

  it("un HTTP qui ne se ferme pas est coupé au plafond, la base est quand même fermée", async () => {
    const closeDatabase = vi.fn(async () => undefined);
    const exit = vi.fn();
    const shutdown = createServerShutdown(exit, TIMINGS, () => {});
    shutdown.register({ closeHttp: () => new Promise(() => {}), closeDatabase });
    void shutdown.run(0, "SIGTERM");
    await vi.advanceTimersByTimeAsync(TIMINGS.httpCloseMs - 1);
    expect(closeDatabase).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("une étape en échec n'empêche pas les suivantes", async () => {
    const exit = vi.fn();
    const log = vi.fn();
    const shutdown = createServerShutdown(exit, TIMINGS, log);
    const closeDatabase = vi.fn(async () => undefined);
    shutdown.register({ stopBackgroundWork: () => { throw new Error("bail perdu"); }, closeDatabase });
    await shutdown.run(0, "quit");
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bail perdu"));
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("deux demandes : un seul arrêt, avec le code de la première", async () => {
    const exit = vi.fn();
    const shutdown = createServerShutdown(exit, TIMINGS, () => {});
    const first = shutdown.run(0, "tentacle:shutdown");
    const second = shutdown.run(75, "extension");
    expect(second).toBe(first);
    await first;
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(shutdown.isRunning()).toBe(true);
  });

  it("avant que le HTTP existe (migration en cours), l'arrêt saute l'étape absente", async () => {
    const exit = vi.fn();
    const releaseLock = vi.fn();
    const shutdown = createServerShutdown(exit, TIMINGS, () => {});
    shutdown.register({ releaseLock });
    await shutdown.run(0, "SIGINT");
    expect(releaseLock).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe("shutdownSignals", () => {
  it("Windows ajoute SIGBREAK et SIGHUP ; Linux garde SIGHUP pour nohup", () => {
    expect(shutdownSignals("win32")).toEqual(["SIGTERM", "SIGINT", "SIGBREAK", "SIGHUP"]);
    expect(shutdownSignals("linux")).toEqual(["SIGTERM", "SIGINT"]);
  });
});
