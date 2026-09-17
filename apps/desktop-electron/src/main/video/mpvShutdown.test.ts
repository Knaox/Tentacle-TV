/**
 * L'arrêt gracieux, sans mpv : ce qui se garde, c'est l'INSTANT du `quit`.
 * Trop tôt sur macOS, il figeait le thread principal ; trop tard sous Linux,
 * il coûtait une demi-seconde fixe à chaque changement d'épisode — le témoin
 * `idle` (mpv détruit sa sortie vidéo AVANT de l'émettre) supprime l'attente.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  api: { commandAsync: vi.fn(() => 0), destroyClient: vi.fn() },
  state: { ctx: {} as unknown, idle: 0, isIdle: false, onShutdown: null as (() => void) | null },
  clearState: vi.fn(),
}));

vi.mock("./mpvFfi", () => ({ mpvApi: () => h.api }));
vi.mock("./mpv", () => ({
  handle: () => h.state.ctx,
  setHandle: (value: unknown) => {
    h.state.ctx = value;
  },
  clearState: h.clearState,
  idleCount: () => h.state.idle,
  isIdle: () => h.state.isIdle,
  setOnShutdown: (callback: (() => void) | null) => {
    h.state.onShutdown = callback;
  },
}));

import { stop } from "./mpvShutdown";

const sent = (): string[] =>
  h.api.commandAsync.mock.calls.map((call) => String((call as unknown[])[2]));

const realPlatform = process.platform;
function onPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  h.api.commandAsync.mockClear();
  h.api.destroyClient.mockClear();
  h.clearState.mockClear();
  h.state.ctx = {};
  h.state.idle = 3;
  h.state.isIdle = false;
  h.state.onShutdown = null;
});

afterEach(() => {
  vi.useRealTimers();
  onPlatform(realPlatform);
});

describe("l'arrêt gracieux", () => {
  it("démonte la vidéo d'abord, et ne demande quit qu'à l'idle", async () => {
    const done = stop();
    expect(sent()).toEqual(["set,force-window,no,", "stop,"]);
    await vi.advanceTimersByTimeAsync(60);
    expect(sent()).toHaveLength(2);
    // mpv annonce l'idle : sa sortie vidéo est déjà détruite (playloop.c).
    h.state.idle += 1;
    await vi.advanceTimersByTimeAsync(20);
    expect(sent().at(-1)).toBe("quit,");
    h.state.onShutdown?.();
    await done;
    expect(h.api.destroyClient).toHaveBeenCalledTimes(1);
    expect(h.state.ctx).toBeNull();
  });

  it("sans idle, le plafond d'une demi-seconde reste le filet", async () => {
    void stop();
    await vi.advanceTimersByTimeAsync(480);
    expect(sent()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(40);
    expect(sent().at(-1)).toBe("quit,");
  });

  it("le témoin de fenêtre (macOS) suffit aussi", async () => {
    void stop(() => true);
    await vi.advanceTimersByTimeAsync(20);
    expect(sent().at(-1)).toBe("quit,");
  });

  it("déjà à l'idle sous Linux (instance gardée au chaud expirée) : force-window=no détruit la fenêtre, quit suit", async () => {
    onPlatform("linux");
    h.state.isIdle = true;
    void stop();
    expect(sent()).toEqual(["set,force-window,no,", "quit,"]);
    await vi.advanceTimersByTimeAsync(600);
    expect(sent()).toHaveLength(2);
  });

  it("déjà à l'idle sur macOS : le chemin ordinaire, jamais quit devant une sortie vidéo vivante", async () => {
    onPlatform("darwin");
    h.state.isIdle = true;
    void stop(() => true);
    expect(sent()).toEqual(["set,force-window,no,", "stop,"]);
    await vi.advanceTimersByTimeAsync(20);
    expect(sent().at(-1)).toBe("quit,");
  });

  it("un idle antérieur à l'arrêt ne compte pas — libmpv en émet un à sa naissance", async () => {
    h.state.idle = 1;
    void stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent()).toHaveLength(2);
  });
});
