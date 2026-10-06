import { describe, expect, it } from "vitest";
import { holdsStart, START_GATE_FALLBACK_MS, startGateOpen } from "./startGate";

const LOADED = 10_000;

describe("le verrou de démarrage", () => {
  it("rien n'est montré avant le « prêt » du flux, quel que soit le moteur", () => {
    expect(startGateOpen({ announcesFirstFrame: false, loadedAt: null, firstFrame: false }, LOADED)).toBe(false);
    expect(startGateOpen({ announcesFirstFrame: true, loadedAt: null, firstFrame: true }, LOADED)).toBe(false);
  });

  it("moteur muet (Apple TV) : le « prêt » suffit, comme avant", () => {
    expect(startGateOpen({ announcesFirstFrame: false, loadedAt: LOADED, firstFrame: false }, LOADED)).toBe(true);
    expect(holdsStart(false, false)).toBe(false);
  });

  it("moteur qui annonce (Android TV) : prêt sans image, l'écran reste ; la première image l'ouvre", () => {
    const state = { announcesFirstFrame: true, loadedAt: LOADED, firstFrame: false };
    expect(startGateOpen(state, LOADED + 500)).toBe(false);
    expect(startGateOpen({ ...state, firstFrame: true }, LOADED + 500)).toBe(true);
  });

  it("filet : une première image qui ne s'annonce pas ne retient pas l'écran plus de 3 s", () => {
    const state = { announcesFirstFrame: true, loadedAt: LOADED, firstFrame: false };
    expect(startGateOpen(state, LOADED + START_GATE_FALLBACK_MS - 1)).toBe(false);
    expect(startGateOpen(state, LOADED + START_GATE_FALLBACK_MS)).toBe(true);
  });

  it("la pause tient tant que la lecture ne s'est pas montrée, puis se lève", () => {
    expect(holdsStart(true, false)).toBe(true);
    expect(holdsStart(true, true)).toBe(false);
  });
});
