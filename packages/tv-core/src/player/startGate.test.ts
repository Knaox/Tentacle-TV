import { describe, expect, it } from "vitest";
import {
  holdsStart, START_AUDIO_WAIT_MS, START_GATE_FALLBACK_MS, startGateOpen, startReleased, type StartGateState,
} from "./startGate";

const LOADED = 10_000;
const base: StartGateState = { announcesFirstFrame: true, loadedAt: LOADED, firstFrameAt: null, audioFollows: true, audioStarted: false };

describe("le verrou de démarrage", () => {
  it("rien ne part ni ne se montre avant le « prêt » du flux, quel que soit le moteur", () => {
    for (const announcesFirstFrame of [false, true]) {
      const state = { ...base, announcesFirstFrame, loadedAt: null, firstFrameAt: LOADED };
      expect(startReleased(state, LOADED)).toBe(false);
      expect(startGateOpen(state, LOADED)).toBe(false);
    }
  });

  it("moteur muet (Apple TV) : le « prêt » suffit, comme avant, et rien n'est tenu", () => {
    const state = { ...base, announcesFirstFrame: false };
    expect(startReleased(state, LOADED)).toBe(true);
    expect(startGateOpen(state, LOADED)).toBe(true);
    expect(holdsStart(false, false)).toBe(false);
  });

  it("Exo : prêt sans image, tout attend ; la première image lève la pause, le départ du son lève l'écran", () => {
    expect(startReleased(base, LOADED + 500)).toBe(false);
    expect(startGateOpen(base, LOADED + 500)).toBe(false);
    const framed = { ...base, firstFrameAt: LOADED + 500 };
    expect(startReleased(framed, LOADED + 500)).toBe(true);
    expect(startGateOpen(framed, LOADED + 700)).toBe(false);
    expect(startGateOpen({ ...framed, audioStarted: true }, LOADED + 700)).toBe(true);
  });

  it("mpv, ou un flux sans son : l'écran se lève avec la pause", () => {
    const framed = { ...base, firstFrameAt: LOADED + 500, audioFollows: false };
    expect(startGateOpen(framed, LOADED + 500)).toBe(true);
  });

  it("filet du son : sans départ annoncé, l'écran se lève 1,5 s après la première image", () => {
    const framed = { ...base, firstFrameAt: LOADED + 500 };
    expect(startGateOpen(framed, LOADED + 500 + START_AUDIO_WAIT_MS - 1)).toBe(false);
    expect(startGateOpen(framed, LOADED + 500 + START_AUDIO_WAIT_MS)).toBe(true);
  });

  it("filet de l'image : une première image qui ne s'annonce pas ne retient rien plus de 3 s", () => {
    expect(startReleased(base, LOADED + START_GATE_FALLBACK_MS - 1)).toBe(false);
    expect(startReleased(base, LOADED + START_GATE_FALLBACK_MS)).toBe(true);
    expect(startGateOpen(base, LOADED + START_GATE_FALLBACK_MS)).toBe(true);
  });

  it("la pause tient tant que le démarrage ne l'a pas relâchée", () => {
    expect(holdsStart(true, false)).toBe(true);
    expect(holdsStart(true, true)).toBe(false);
  });
});
