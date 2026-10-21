import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Le redimensionnement de la fenêtre, vu par les surfaces fixes du lecteur :
 * vrai dès le PREMIER `resize` (synchrone, avant que la primitive ne mesure),
 * faux une fois la taille posée.
 */

beforeAll(() => {
  (globalThis as { window?: EventTarget }).window = new EventTarget();
});
afterEach(() => vi.useRealTimers());

const load = () => import("./windowResizing");
const resize = () => window.dispatchEvent(new Event("resize"));

describe("le redimensionnement de la fenêtre", () => {
  it("vrai dès le premier resize, prévenu une fois par rafale, faux après le calme", async () => {
    vi.useFakeTimers();
    const { subscribeWindowResizing, isWindowResizing, RESIZE_SETTLE_MS } = await load();
    const told = vi.fn();
    const off = subscribeWindowResizing(told);
    expect(isWindowResizing()).toBe(false);
    resize();
    expect(isWindowResizing()).toBe(true);
    expect(told).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RESIZE_SETTLE_MS - 50);
    resize();
    resize();
    expect(told).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RESIZE_SETTLE_MS - 1);
    expect(isWindowResizing()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isWindowResizing()).toBe(false);
    expect(told).toHaveBeenCalledTimes(2);
    off();
  });

  it("plus aucun abonné : plus d'écoute, rien ne reste vrai", async () => {
    vi.useFakeTimers();
    const { subscribeWindowResizing, isWindowResizing } = await load();
    const off = subscribeWindowResizing(() => undefined);
    resize();
    expect(isWindowResizing()).toBe(true);
    off();
    expect(isWindowResizing()).toBe(false);
    resize();
    expect(isWindowResizing()).toBe(false);
  });
});
