import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBack } from "../nav/backResolve";
import { BACK_GRACE_MS, createPlayerBack } from "./playerBack";
import { TRAILER_NO_SURFACE, trailerBackLayers } from "./trailerBack";
import type { TrailerState } from "./trailerChrome";
import type { TrailerPanel } from "./trailerPanels";

const back = (init: { trailer?: TrailerState; scrubbing?: boolean; graceActive?: boolean; panel?: TrailerPanel | null; chromeShown?: boolean }) =>
  resolveBack(
    trailerBackLayers({ trailer: "playing", scrubbing: false, graceActive: false, panel: null, chromeShown: false, ...init }),
    { pushed: true },
  );

describe("le Retour de la bande-annonce, en couches (celles du grand lecteur)", () => {
  it("défilement ouvert ou grâce d'un Retour pris : l'état passager d'abord", () => {
    expect(back({ scrubbing: true, chromeShown: true })).toMatchObject({ kind: "layer", action: "routeTransient" });
    expect(back({ graceActive: true })).toMatchObject({ kind: "layer", action: "routeTransient" });
  });

  it("panneau ouvert : il se ferme, la lecture continue", () => {
    expect(back({ panel: "subtitles", chromeShown: true })).toMatchObject({ kind: "layer", action: "closePanel" });
  });

  it("chrome à l'écran pendant la lecture : il se masque ; un second Retour quitte", () => {
    expect(back({ chromeShown: true })).toMatchObject({ kind: "layer", action: "hideChrome" });
    expect(back({ chromeShown: false })).toMatchObject({ action: "leave" });
  });

  it("chargement ou indisponible : Retour quitte, même chrome affiché", () => {
    expect(back({ trailer: "loading", chromeShown: true })).toMatchObject({ action: "leave" });
    expect(back({ trailer: "unavailable", chromeShown: true })).toMatchObject({ action: "leave" });
  });
});

describe("l'état passager, routé par le Retour du grand lecteur", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("annule le défilement, puis avale un Retour rapproché", () => {
    const TIMERS = {
      now: () => Date.now(),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
    let scrubbing = true;
    const log: string[] = [];
    const router = createPlayerBack({
      isScrubbing: () => scrubbing,
      readSurface: () => TRAILER_NO_SURFACE,
      cancelScrub: () => { scrubbing = false; log.push("cancel"); },
      dismissSurface: () => false,
      dismissSegment: () => {},
      onGrace: (on) => log.push(`grace:${on}`),
    }, TIMERS);
    expect(router.routeBack()).toBe(true);
    expect(router.routeBack()).toBe(true);
    expect(log).toEqual(["cancel", "grace:true"]);
    vi.advanceTimersByTime(BACK_GRACE_MS);
    expect(router.routeBack()).toBe(false);
  });
});
