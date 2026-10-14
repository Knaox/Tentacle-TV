/**
 * Le signal « le pointeur bouge » de l'intention : seulement au-delà du seuil
 * (le tremblement d'un pavé tactile ne compte pas), à chaque coup de molette,
 * et des écouteurs posés sur la fenêtre le temps d'un abonnement seulement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAILER_PREVIEW_TIMING as T } from "@tentacle-tv/shared";

type Handler = (event: { clientX: number; clientY: number }) => void;
const handlers = new Map<string, Handler>();
const fakeWindow = {
  addEventListener: vi.fn((type: string, handler: Handler) => handlers.set(type, handler)),
  removeEventListener: vi.fn((type: string) => handlers.delete(type)),
};

beforeEach(() => {
  handlers.clear();
  vi.stubGlobal("window", fakeWindow);
});
afterEach(() => vi.unstubAllGlobals());

const { subscribePointerMotion } = await import("./pointerMotion");
const pointer = (x: number, y: number) => handlers.get("pointermove")?.({ clientX: x, clientY: y });

describe("subscribePointerMotion", () => {
  it("le premier mouvement fixe le départ ; seuls comptent ceux qui s'en éloignent au-delà du seuil", () => {
    const moved = vi.fn();
    const stop = subscribePointerMotion(moved);
    pointer(100, 100);
    pointer(100 + T.intentMovePx, 100);
    expect(moved).not.toHaveBeenCalled();
    pointer(100 + T.intentMovePx + 1, 100);
    expect(moved).toHaveBeenCalledTimes(1);
    // Le départ suit le pointeur : un nouveau petit tremblement ne compte pas.
    pointer(100 + T.intentMovePx + 3, 101);
    expect(moved).toHaveBeenCalledTimes(1);
    stop();
  });

  it("chaque coup de molette compte (la page défile sous le pointeur)", () => {
    const moved = vi.fn();
    const stop = subscribePointerMotion(moved);
    handlers.get("wheel")?.({ clientX: 0, clientY: 0 });
    handlers.get("wheel")?.({ clientX: 0, clientY: 0 });
    expect(moved).toHaveBeenCalledTimes(2);
    stop();
  });

  it("rien n'écoute la fenêtre sans abonné", () => {
    const stop = subscribePointerMotion(() => undefined);
    expect(handlers.has("pointermove")).toBe(true);
    stop();
    expect(handlers.size).toBe(0);
  });
});
