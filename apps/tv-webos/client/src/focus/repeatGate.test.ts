import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La garde des répétitions : la touche maintenue va aussi vite que la dalle
 * affiche, et s'arrête avec elle. Les images sont simulées — une file de
 * `requestAnimationFrame` qu'on vide à la main.
 */

let frames: Array<() => void> = [];
const listeners = new Map<string, () => void>();

function nextFrame(): void {
  const pending = frames;
  frames = [];
  pending.forEach((callback) => callback());
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  frames = [];
  listeners.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("document", {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("garde des répétitions", () => {
  it("avale la même direction tant que le déplacement n'est pas à l'écran", async () => {
    const { admitMove } = await import("./repeatGate");
    expect(admitMove("droite")).toBe(true);
    expect(admitMove("droite")).toBe(false);
    nextFrame();
    expect(admitMove("droite")).toBe(false);
    nextFrame();
    expect(admitMove("droite")).toBe(true);
  });

  it("laisse passer une autre direction : c'est un geste nouveau", async () => {
    const { admitMove } = await import("./repeatGate");
    expect(admitMove("bas")).toBe(true);
    expect(admitMove("gauche")).toBe(true);
  });

  it("ne reste pas muette si les images ne viennent pas", async () => {
    const { admitMove } = await import("./repeatGate");
    expect(admitMove("haut")).toBe(true);
    vi.advanceTimersByTime(150);
    expect(admitMove("haut")).toBe(true);
  });

  it("attend la carte d'un pas de révélation, jusqu'à l'arrivée du focus", async () => {
    const { admitMove, holdWhileRevealing } = await import("./repeatGate");
    expect(admitMove("bas")).toBe(true);
    holdWhileRevealing("bas");
    vi.advanceTimersByTime(150);
    expect(admitMove("bas")).toBe(false);
    listeners.get("focusin")?.();
    expect(admitMove("bas")).toBe(true);
  });

  it("renonce à attendre au-delà de deux pas", async () => {
    const { admitMove, holdWhileRevealing } = await import("./repeatGate");
    holdWhileRevealing("bas");
    vi.advanceTimersByTime(900);
    expect(admitMove("bas")).toBe(true);
  });
});
