/**
 * Le parking de mpv : ce qui se garde, c'est qu'une instance garée est reprise
 * SEULEMENT avec les mêmes options et dans le délai, et qu'un refus ou une
 * reprise vident le parking sans faire tirer l'expiration.
 */

import { describe, expect, it, vi } from "vitest";
import { Park, optionsSignature } from "./mpvPark";

function fakeTimers(): { timers: { set: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> }; fire: () => void } {
  let pending: (() => void) | null = null;
  const timers = {
    set: vi.fn((callback: () => void) => {
      pending = callback;
      return 1;
    }),
    clear: vi.fn(() => {
      pending = null;
    }),
  };
  return { timers, fire: () => pending?.() };
}

describe("le parking", () => {
  it("reprend l'instance garée avec les mêmes options, sans expiration", () => {
    const expire = vi.fn();
    const { timers, fire } = fakeTimers();
    const park = new Park(expire, 3000, timers);
    park.park("a");
    expect(park.isParked()).toBe(true);
    expect(park.reuse("a")).toBe(true);
    expect(park.isParked()).toBe(false);
    fire();
    expect(expire).not.toHaveBeenCalled();
  });

  it("refuse des options différentes, et vide le parking sans arrêter lui-même", () => {
    const expire = vi.fn();
    const { timers, fire } = fakeTimers();
    const park = new Park(expire, 3000, timers);
    park.park("a");
    expect(park.reuse("b")).toBe(false);
    expect(park.isParked()).toBe(false);
    fire();
    expect(expire).not.toHaveBeenCalled();
  });

  it("expire seul quand rien ne vient — c'est le retour à la bibliothèque", () => {
    const expire = vi.fn();
    const { timers, fire } = fakeTimers();
    const park = new Park(expire, 3000, timers);
    park.park("a");
    expect(timers.set).toHaveBeenCalledWith(expect.any(Function), 3000);
    fire();
    expect(expire).toHaveBeenCalledTimes(1);
    expect(park.isParked()).toBe(false);
    expect(park.reuse("a")).toBe(false);
  });

  it("rien de garé : rien à reprendre", () => {
    const park = new Park(vi.fn(), 3000, fakeTimers().timers);
    expect(park.reuse("a")).toBe(false);
  });
});

describe("la signature des options", () => {
  it("ignore la taille de naissance, retient tout le reste et les propriétés observées", () => {
    const observed = [["pause", "flag"]] as const;
    const a = optionsSignature({ vo: "gpu-next", geometry: "2304x1600" }, observed);
    const b = optionsSignature({ vo: "gpu-next", geometry: "1920x1080" }, observed);
    const c = optionsSignature({ vo: "gpu-next", hwdec: "no" }, observed);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(optionsSignature({ vo: "gpu-next" }, [])).not.toBe(a);
  });
});
