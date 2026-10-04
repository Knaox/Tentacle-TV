import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteIntent } from "../remote/intents";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import type { ScrubInputProfile } from "./arrowHold";
import { createPlayerControls } from "./playerControls";
import { applyPlayerRemoteSteps, playerRemoteSteps } from "./playerRemote";
import type { ScrubCountdownPolicy, ScrubCountdownState } from "./scrubCountdown";
import { SCRUB_COUNTDOWN_DEFAULTS, SCRUB_COUNTDOWN_DELAYS, scrubCountdownPolicyOf } from "./scrubCountdownSettings";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Le réglage « Avance rapide », joué de bout en bout : intention de la Siri
 * Remote → contrôles du lecteur → ce que la lecture reçoit. La position de
 * départ est 1200 s ; « revenir » ne demande AUCUN seek (la vidéo, figée en
 * pause pendant le défilement, repart d'où elle était).
 */

const TVOS: ScrubInputProfile = { tapOnRelease: false, holdFromKeyDown: false, holdArmMs: 0, holdEndAnnounced: true };

function player(policy: ScrubCountdownPolicy | undefined, init: { paused?: boolean } = {}) {
  const s = { position: 1200, duration: 3000, paused: init.paused ?? false };
  const log: string[] = [];
  const view = { overlay: false, scrubbing: false, target: 0, countdown: null as ScrubCountdownState | null };
  const controls = createPlayerControls({
    readPosition: () => s.position,
    writePosition: (v) => { s.position = v; },
    readDuration: () => s.duration,
    readPaused: () => s.paused,
    isPanelOpen: () => false,
    isOverlayVisible: () => view.overlay,
    backgroundHoldsFocus: () => true,
    seek: (v) => log.push(`seek:${v}`),
    back: () => log.push("back"),
    playPause: () => { s.paused = !s.paused; },
    scrubPause: (p) => { s.paused = p; log.push(`scrubPause:${p}`); },
    onOverlayVisible: (v) => { view.overlay = v; },
    onSkipFlash: () => {},
    onScrubbing: (v) => { view.scrubbing = v; },
    onPosition: (v) => { view.target = v; },
    onSpeedLabel: () => {},
    onCountdown: (c) => { view.countdown = c; },
  }, { profile: TVOS, timers: TIMERS, initialPanelOpen: false, readCountdownPolicy: policy ? () => policy : undefined });
  const send = (intent: RemoteIntent) => applyPlayerRemoteSteps(playerRemoteSteps(intent, TVOS_BINDINGS.traits), controls.remote);
  return { s, log, view, controls, send };
}

const RIGHT: RemoteIntent = { type: "move", direction: "droite" };
const holdRight = (phase: "start" | "end"): RemoteIntent => ({ type: "hold", key: "droite", phase });
const RETURN_DEFAULT = scrubCountdownPolicyOf(SCRUB_COUNTDOWN_DEFAULTS);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("le défaut du réglage : revenir où j'étais, au bout de 5 s", () => {
  it("maintien → puis relâchement : « retour » décompté, puis la lecture repart d'où elle était, sans seek", () => {
    const p = player(RETURN_DEFAULT);

    p.send(holdRight("start"));
    vi.advanceTimersByTime(1100);
    p.send(holdRight("end"));
    expect(p.view.target).toBeGreaterThan(1200);
    expect(p.view.countdown).toEqual({ remaining: 5, total: 5, outcome: "return" });
    vi.advanceTimersByTime(4999);
    expect(p.view.scrubbing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(p.view.scrubbing).toBe(false);
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:false"]);
    expect(p.s.position).toBe(1200);
  });

  it("OK valide tout de suite : la lecture part de la cible", () => {
    const p = player(RETURN_DEFAULT);

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    p.send({ type: "select" });
    expect(p.view.scrubbing).toBe(false);
    expect(p.log).toEqual(["scrubPause:true", "seek:1230", "scrubPause:false"]);
  });

  it("chaque geste relance le décompte entier", () => {
    const p = player(RETURN_DEFAULT);

    p.controls.enterScrub();
    vi.advanceTimersByTime(4500);
    p.send(RIGHT);
    expect(p.view.countdown?.remaining).toBe(5);
    vi.advanceTimersByTime(4999);
    expect(p.view.scrubbing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:false"]);
  });

  it("entré en pause : ni décompte ni retour seul ; Retour rend la pause, sans seek", () => {
    const p = player(RETURN_DEFAULT, { paused: true });

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    expect(p.view.countdown).toBeNull();
    vi.advanceTimersByTime(120_000);
    expect(p.view.scrubbing).toBe(true);
    p.controls.remote.back();
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:true"]);
  });
});

describe("reprendre à la nouvelle position", () => {
  it("au bout du délai choisi (10 s), la lecture part de la cible", () => {
    const p = player({ outcome: "resume", delayMs: 10_000 });

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    expect(p.view.countdown).toEqual({ remaining: 10, total: 10, outcome: "resume" });
    vi.advanceTimersByTime(9999);
    expect(p.view.scrubbing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(p.log).toEqual(["scrubPause:true", "seek:1230", "scrubPause:false"]);
  });

  it("Retour annule : la lecture repart d'où elle était, le lecteur reste ouvert", () => {
    const p = player({ outcome: "resume", delayMs: 3000 });

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    p.controls.remote.back();
    expect(p.view.scrubbing).toBe(false);
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:false"]);
    vi.advanceTimersByTime(60_000);
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:false"]);
  });
});

describe("chaque délai offert, dans les deux issues", () => {
  const cases = (["return", "resume"] as const).flatMap((outcome) =>
    SCRUB_COUNTDOWN_DELAYS.map((delaySeconds) => ({ outcome, delaySeconds })));

  it.each(cases)("$outcome au bout de $delaySeconds s", ({ outcome, delaySeconds }) => {
    const p = player(scrubCountdownPolicyOf({ outcome, delaySeconds }));

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    vi.advanceTimersByTime(delaySeconds * 1000 - 1);
    expect(p.view.scrubbing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(p.view.scrubbing).toBe(false);
    expect(p.log).toEqual(outcome === "return"
      ? ["scrubPause:true", "scrubPause:false"]
      : ["scrubPause:true", "seek:1230", "scrubPause:false"]);
  });
});

describe("sans réglage (Android TV)", () => {
  it("la politique d'avant : la lecture repart à la cible au bout de 5 s", () => {
    const p = player(undefined);

    p.controls.enterScrub();
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    expect(p.view.countdown).toEqual({ remaining: 5, total: 5, outcome: "resume" });
    vi.advanceTimersByTime(5000);
    expect(p.log).toEqual(["scrubPause:true", "seek:1230", "scrubPause:false"]);
  });
});
