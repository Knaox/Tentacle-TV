import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBack } from "../nav/backResolve";
import {
  BACK_GRACE_MS, createPlayerBack, decidePlayerBack, isOsdPinned, playerBackHolding, playerBackLayers, type PlayerBackSurface,
} from "./playerBack";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const NONE: PlayerBackSurface = { kind: "none" };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("le Retour des états passagers", () => {
  it("dans l'ordre : grâce, défilement, carte ou fin, passage automatique refusable", () => {
    const base = { now: 1000, graceUntil: 0, scrubbing: false, surface: NONE };
    expect(decidePlayerBack({ ...base, graceUntil: 1001, scrubbing: true })).toBe("swallow");
    expect(decidePlayerBack({ ...base, scrubbing: true, surface: { kind: "nextCard" } })).toBe("cancelScrub");
    expect(decidePlayerBack({ ...base, surface: { kind: "nextCard" } })).toBe("dismissSurface");
    expect(decidePlayerBack({ ...base, surface: { kind: "skip", auto: true, dismissible: true } })).toBe("dismissSegment");
    expect(decidePlayerBack({ ...base, surface: { kind: "skip", auto: false, dismissible: true } })).toBeNull();
    expect(decidePlayerBack({ ...base, surface: { kind: "skip", auto: true, dismissible: false } })).toBeNull();
    expect(decidePlayerBack(base)).toBeNull();
  });

  it("arme 600 ms de grâce après un Retour pris ; pas après un départ engagé", () => {
    const calls: string[] = [];
    const state = { scrubbing: true, surface: NONE, leaving: false };
    const back = createPlayerBack({
      isScrubbing: () => state.scrubbing,
      readSurface: () => state.surface,
      cancelScrub: () => { state.scrubbing = false; calls.push("cancel"); },
      dismissSurface: () => { calls.push("dismiss"); return state.leaving; },
      dismissSegment: () => calls.push("segment"),
      onGrace: (on) => calls.push(on ? "grace" : "graceOff"),
    }, TIMERS);

    expect(back.routeBack()).toBe(true);
    expect(back.routeBack()).toBe(true); // avalé
    vi.advanceTimersByTime(BACK_GRACE_MS);
    expect(back.routeBack()).toBe(false);
    expect(calls).toEqual(["cancel", "grace", "graceOff"]);

    state.surface = { kind: "nextCard" };
    state.leaving = true;
    expect(back.routeBack()).toBe(true);
    expect(calls.slice(3)).toEqual(["dismiss"]);
    back.destroy();
  });

  it("dit d'avance ce qu'il prendrait", () => {
    const off = { scrubbing: false, surfaceActive: false, skipRefusable: false, graceActive: false };
    expect(playerBackHolding(off)).toBe(false);
    for (const key of Object.keys(off) as Array<keyof typeof off>) expect(playerBackHolding({ ...off, [key]: true })).toBe(true);
  });
});

describe("les couches du Retour du lecteur", () => {
  const layers = (s: Partial<Parameters<typeof playerBackLayers>[0]>) =>
    resolveBack(playerBackLayers({ transient: false, showSettings: false, showEpisodes: false, osdShown: false, ...s }), { pushed: true });

  it("rien d'affiché : Retour quitte la lecture", () => {
    expect(layers({})).toEqual({ kind: "layer", id: "page", action: "leave" });
  });

  it("habillage à l'écran : il se masque", () => {
    expect(layers({ osdShown: true })).toMatchObject({ action: "hideOverlay" });
  });

  it("un menu passe devant l'habillage ; à rang égal, le dernier de la liste", () => {
    expect(layers({ osdShown: true, showSettings: true })).toMatchObject({ action: "closeSettings" });
    expect(layers({ osdShown: true, showEpisodes: true })).toMatchObject({ action: "closeEpisodes" });
    expect(layers({ transient: true, showEpisodes: true })).toMatchObject({ action: "closeEpisodes" });
    expect(layers({ transient: true, osdShown: true })).toMatchObject({ action: "routeTransient" });
  });
});

describe("l'épingle de la pause", () => {
  it("épinglé en pause, sauf masqué par Retour", () => {
    expect(isOsdPinned(true, false)).toBe(true);
    expect(isOsdPinned(true, true)).toBe(false);
    expect(isOsdPinned(false, false)).toBe(false);
  });
});
