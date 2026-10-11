import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANDROIDTV_BINDINGS } from "../remote/bindings/androidtv";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import type { RemoteIntent } from "../remote/intents";
import { scrubInputProfileOf } from "./arrowHold";
import { applyPlayerRemoteSteps } from "./playerRemote";
import { RESUME_COUNTDOWN_MS } from "./seekTuning";
import { TRAILER_CLOSE_KEY, TRAILER_IDLE_MS, type TrailerState } from "./trailerChrome";
import {
  createTrailerControls, trailerControlsReads, trailerRemoteSteps, trailerSelectAction, type TrailerControlsView,
} from "./trailerControls";
import { TRAILER_QUALITY_KEY, TRAILER_SUBTITLES_KEY, TRAILER_TIMELINE_KEY } from "./trailerFocus";
import type { TrailerPanel } from "./trailerPanels";

const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const RIGHT: RemoteIntent = { type: "move", direction: "droite" };
const LEFT: RemoteIntent = { type: "move", direction: "gauche" };
const UP: RemoteIntent = { type: "move", direction: "haut" };
const SELECT: RemoteIntent = { type: "select" };
const holdRight = (phase: "start" | "update" | "end"): RemoteIntent => ({ type: "hold", key: "droite", phase });

/** Un écran de bande-annonce joué de bout en bout : intention → gestes → contrôles. */
function trailer(init: {
  state?: TrailerState; chrome?: boolean; focused?: string | null; panel?: TrailerPanel | null; paused?: boolean;
  bindings?: typeof TVOS_BINDINGS;
} = {}) {
  const bindings = init.bindings ?? TVOS_BINDINGS;
  const view: TrailerControlsView = {
    state: init.state ?? "playing",
    chromeVisible: init.chrome ?? true,
    focusedKey: init.focused === undefined ? TRAILER_TIMELINE_KEY : init.focused,
    panel: init.panel ?? null,
  };
  const s = { position: 60, duration: 150, paused: init.paused ?? false, scrubbing: false, flash: null as number | null };
  const log: string[] = [];
  const controls = createTrailerControls({
    readView: () => view,
    readPosition: () => s.position,
    writePosition: (v) => { s.position = v; },
    readDuration: () => s.duration,
    readPaused: () => s.paused,
    seek: (v) => log.push(`seek:${v}`),
    playPause: () => { s.paused = !s.paused; log.push(s.paused ? "pause" : "play"); },
    scrubPause: (p) => { s.paused = p; },
    onChromeVisible: (v) => { view.chromeVisible = v; },
    onSkipFlash: (f) => { s.flash = f?.delta ?? null; },
    onScrubbing: (v) => { s.scrubbing = v; },
    onPosition: () => {},
    onSpeedLabel: () => {},
    onCountdown: () => {},
    leave: () => log.push("leave"),
  }, { profile: scrubInputProfileOf(bindings.traits), timers: TIMERS });
  const send = (intent: RemoteIntent) =>
    applyPlayerRemoteSteps(trailerRemoteSteps(intent, bindings.traits, null, view.focusedKey), controls.remote);
  /** OK sur la cible focalisée : son appui, sous la garde des contrôles. */
  const press = () => controls.guarded(() => {
    const action = trailerSelectAction(view.focusedKey ?? "", view.chromeVisible);
    if (action === "reveal") controls.showOverlay();
    else if (action === "playPause") controls.remote.playPause();
    else log.push(action);
  })();
  return { view, s, log, controls, send, press };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("avancer et reculer : la barre tient les flèches", () => {
  it("chrome estompé : → +30 s, ← −10 s, cumulés depuis la dernière cible ; le chrome reste éteint", () => {
    const t = trailer({ chrome: false });
    t.send(RIGHT);
    t.send(RIGHT);
    t.send(LEFT);
    expect(t.log).toEqual(["seek:90", "seek:120", "seek:110"]);
    expect(t.s.flash).toBe(-10);
    expect(t.view.chromeVisible).toBe(false);
  });

  it("chrome affiché, barre focalisée : les flèches sautent aussi, et le chrome reste (l'attente repart)", () => {
    const t = trailer({ chrome: true });
    vi.advanceTimersByTime(TRAILER_IDLE_MS - 500);
    t.send(RIGHT);
    expect(t.log).toEqual(["seek:90"]);
    vi.advanceTimersByTime(TRAILER_IDLE_MS - 1);
    expect(t.view.chromeVisible).toBe(true);
  });

  it("un saut ne dépasse ni le début ni la fin", () => {
    const t = trailer({ chrome: false });
    t.s.position = 5;
    t.send(LEFT);
    t.s.position = 140;
    t.send(RIGHT);
    expect(t.log).toEqual(["seek:0", "seek:150"]);
  });

  it("un bouton focalisé : les flèches naviguent, la vidéo ne bouge pas", () => {
    for (const focused of [TRAILER_CLOSE_KEY, TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY]) {
      const t = trailer({ chrome: true, focused });
      t.send(RIGHT);
      t.send(LEFT);
      expect(t.log).toEqual([]);
    }
  });

  it("le maintien de → ouvre le défilement (le moteur du grand lecteur), le décompte relance la lecture", () => {
    const t = trailer({ chrome: true });
    t.send(holdRight("start"));
    expect(t.s.scrubbing).toBe(true);
    expect(t.view.chromeVisible).toBe(false);
    vi.advanceTimersByTime(1100);
    t.send(holdRight("end"));
    vi.advanceTimersByTime(RESUME_COUNTDOWN_MS);
    expect(t.s.scrubbing).toBe(false);
    expect(t.log.at(-1)).toMatch(/^seek:/);
  });

  it("le maintien sur un bouton n'ouvre rien", () => {
    const t = trailer({ chrome: true, focused: TRAILER_SUBTITLES_KEY });
    t.send(holdRight("start"));
    expect(t.s.scrubbing).toBe(false);
  });

  it("rien à lire (chargement, indisponible) ou panneau ouvert : les flèches et Lecture/Pause n'agissent pas", () => {
    for (const init of [{ state: "loading" as const }, { state: "unavailable" as const }, { panel: "quality" as const }]) {
      const t = trailer({ ...init, chrome: true });
      t.send(RIGHT);
      t.send({ type: "playPause" });
      t.send(holdRight("start"));
      expect(t.log).toEqual([]);
      expect(t.s.scrubbing).toBe(false);
    }
  });
});

describe("le chrome", () => {
  it("s'estompe trois secondes après le dernier geste, en lecture", () => {
    const t = trailer({ chrome: true });
    t.controls.showOverlay();
    vi.advanceTimersByTime(TRAILER_IDLE_MS - 1);
    expect(t.view.chromeVisible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(t.view.chromeVisible).toBe(false);
  });

  it("jamais en pause, panneau ouvert, chargement ou indisponible", () => {
    for (const init of [{ paused: true }, { panel: "subtitles" as const }, { state: "loading" as const }, { state: "unavailable" as const }]) {
      const t = trailer({ ...init, chrome: true });
      t.controls.showOverlay();
      vi.advanceTimersByTime(TRAILER_IDLE_MS * 10);
      expect(t.view.chromeVisible).toBe(true);
    }
  });

  it("↑ et ↓ le rallument ; Lecture/Pause bascule ET le rallume", () => {
    const t = trailer({ chrome: false });
    t.send(UP);
    expect(t.view.chromeVisible).toBe(true);
    t.controls.hideOverlay();
    t.send({ type: "playPause" });
    expect(t.log).toEqual(["pause"]);
    expect(t.view.chromeVisible).toBe(true);
  });
});

describe("OK puis OK, sur les deux plateformes", () => {
  for (const bindings of [TVOS_BINDINGS, ANDROIDTV_BINDINGS]) {
    it(`${bindings === TVOS_BINDINGS ? "Apple TV" : "Android TV"} : chrome estompé, le premier OK montre, le second met en pause`, () => {
      const t = trailer({ chrome: false, bindings });
      t.send(SELECT);
      t.press();
      expect(t.view.chromeVisible).toBe(true);
      expect(t.log).toEqual([]);
      t.send(SELECT);
      t.press();
      expect(t.log).toEqual(["pause"]);
    });
  }

  it("l'événement global d'OK sur la barre ne rallume pas le chrome (seul l'appui décide, quel que soit l'ordre)", () => {
    const steps = trailerRemoteSteps(SELECT, TVOS_BINDINGS.traits, null, TRAILER_TIMELINE_KEY).map((s) => s.kind);
    expect(steps).not.toContain("anyPress");
    const elsewhere = trailerRemoteSteps(SELECT, TVOS_BINDINGS.traits, null, TRAILER_CLOSE_KEY).map((s) => s.kind);
    expect(elsewhere).toContain("anyPress");
  });

  it("défilement ouvert : OK le valide, ne met pas en pause", () => {
    const t = trailer({ chrome: true });
    t.send(holdRight("start"));
    vi.advanceTimersByTime(1100);
    t.send(holdRight("end"));
    vi.advanceTimersByTime(500);
    t.press();
    expect(t.s.scrubbing).toBe(false);
    expect(t.log).not.toContain("pause");
  });

  it("OK sur les boutons : quitter, ouvrir un panneau", () => {
    expect(trailerSelectAction(TRAILER_CLOSE_KEY, true)).toBe("leave");
    expect(trailerSelectAction(TRAILER_SUBTITLES_KEY, true)).toBe("openSubtitles");
    expect(trailerSelectAction(TRAILER_QUALITY_KEY, true)).toBe("openQuality");
    expect(trailerSelectAction("ailleurs", true)).toBe("none");
  });
});

describe("ce que les contrôles lisent de l'écran", () => {
  it("la barre (ou aucun focus) tient les flèches ; un bouton les rend à la navigation", () => {
    const base = { state: "playing" as const, chromeVisible: true, panel: null };
    expect(trailerControlsReads({ ...base, focusedKey: TRAILER_TIMELINE_KEY })).toEqual({
      panelOpen: false, overlayVisible: false, backgroundHoldsFocus: true,
    });
    expect(trailerControlsReads({ ...base, focusedKey: null }).backgroundHoldsFocus).toBe(true);
    expect(trailerControlsReads({ ...base, focusedKey: TRAILER_CLOSE_KEY })).toEqual({
      panelOpen: false, overlayVisible: true, backgroundHoldsFocus: false,
    });
    expect(trailerControlsReads({ ...base, state: "loading", focusedKey: TRAILER_CLOSE_KEY }).panelOpen).toBe(true);
  });
});
