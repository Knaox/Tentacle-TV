import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteIntent } from "../remote/intents";
import { TVOS_BINDINGS } from "../remote/bindings/tvos";
import type { ScrubInputProfile } from "./arrowHold";
import { OVERLAY_HIDE_MS } from "./overlayAutoHide";
import { createPlayerControls } from "./playerControls";
import { applyPlayerRemoteSteps, playerRemoteSteps } from "./playerRemote";
import { RESUME_COUNTDOWN_MS } from "./seekTuning";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * La table « intention → effet » du lecteur, contexte par contexte (relevé :
 * `docs/tv-navigation/lecteur.md`, § 4), jouée de bout en bout : intention de
 * la Siri Remote → gestes du lecteur → contrôles.
 */

const TVOS: ScrubInputProfile = { tapOnRelease: false, holdFromKeyDown: false, holdArmMs: 0, holdEndAnnounced: true };

function player(init: { paused?: boolean; panel?: boolean; overlay?: boolean; background?: boolean } = {}) {
  const s = { position: 1200, duration: 3000, paused: false, panel: false, overlay: true, background: false, ...init };
  const log: string[] = [];
  const view = { overlay: s.overlay, scrubbing: false, target: 0, flash: null as number | null, countdown: null as number | null };
  const controls = createPlayerControls({
    readPosition: () => s.position,
    writePosition: (v) => { s.position = v; },
    readDuration: () => s.duration,
    readPaused: () => s.paused,
    isPanelOpen: () => s.panel,
    isOverlayVisible: () => view.overlay,
    backgroundHoldsFocus: () => s.background,
    seek: (v) => log.push(`seek:${v}`),
    back: () => log.push("back"),
    playPause: () => { s.paused = !s.paused; log.push(s.paused ? "pause" : "play"); },
    scrubPause: (p) => { s.paused = p; log.push(`scrubPause:${p}`); },
    onOverlayVisible: (v) => { view.overlay = v; },
    onSkipFlash: (f) => { view.flash = f?.delta ?? null; },
    onScrubbing: (v) => { view.scrubbing = v; },
    onPosition: (v) => { view.target = v; },
    onSpeedLabel: () => {},
    onCountdown: (c) => { view.countdown = c?.remaining ?? null; },
  }, { profile: TVOS, timers: TIMERS, initialPanelOpen: false });
  const send = (intent: RemoteIntent) => applyPlayerRemoteSteps(playerRemoteSteps(intent, TVOS_BINDINGS.traits), controls.remote);
  return { s, log, view, controls, send };
}

const RIGHT: RemoteIntent = { type: "move", direction: "droite" };
const LEFT: RemoteIntent = { type: "move", direction: "gauche" };
const UP: RemoteIntent = { type: "move", direction: "haut" };
const holdRight = (phase: "start" | "update" | "end"): RemoteIntent => ({ type: "hold", key: "droite", phase });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("habillage masqué, fond focalisé", () => {
  it("→ saute de +30 s, ← de −10 s, depuis la dernière cible ; le badge cumule ; rien ne se rallume", () => {
    const p = player({ overlay: false, background: true });

    p.send(RIGHT);
    p.send(RIGHT);
    expect(p.log).toEqual(["seek:1230", "seek:1260"]);
    expect(p.view.flash).toBe(60);
    p.send(LEFT);
    expect(p.log.at(-1)).toBe("seek:1250");
    expect(p.view.flash).toBe(-10);
    expect(p.view.overlay).toBe(false);
  });

  it("↑, OK et ▶︎❙❙ rallument l'habillage ; ▶︎❙❙ bascule la lecture", () => {
    const up = player({ overlay: false, background: true });
    up.send(UP);
    expect(up.view.overlay).toBe(true);

    const ok = player({ overlay: false, background: true });
    ok.send({ type: "select" });
    expect(ok.view.overlay).toBe(true);

    const pp = player({ overlay: false, background: true });
    pp.send({ type: "playPause" });
    expect(pp.log).toEqual(["pause"]);
    expect(pp.view.overlay).toBe(true);
  });

  it("maintien → : défilement en pause, puis reprise à la cible 5 s après le relâchement", () => {
    const p = player({ overlay: false, background: true });

    p.send(holdRight("start"));
    expect(p.view.scrubbing).toBe(true);
    expect(p.log).toEqual(["scrubPause:true"]);
    vi.advanceTimersByTime(1100);
    p.send(holdRight("end"));
    expect(p.view.countdown).toBe(5);
    vi.advanceTimersByTime(RESUME_COUNTDOWN_MS);
    expect(p.view.scrubbing).toBe(false);
    expect(p.log.slice(1)).toEqual([`seek:${p.view.target}`, "scrubPause:false"]);
    expect(p.view.target).toBeGreaterThan(1200);
  });

  it("un maintien que tvOS dit « Changed » vaut relâchement", () => {
    const p = player({ overlay: false, background: true });

    p.send(holdRight("start"));
    vi.advanceTimersByTime(600);
    p.send(holdRight("update"));
    expect(p.view.countdown).toBe(5);
  });
});

describe("habillage affiché", () => {
  it("←/→ ne sautent pas : ils rallument (le focus natif parcourt la rangée)", () => {
    const p = player({ overlay: true });

    vi.advanceTimersByTime(OVERLAY_HIDE_MS - 1000);
    p.send(RIGHT);
    expect(p.log).toEqual([]);
    vi.advanceTimersByTime(OVERLAY_HIDE_MS - 1);
    expect(p.view.overlay).toBe(true);
    vi.advanceTimersByTime(1);
    expect(p.view.overlay).toBe(false);
  });

  it("le maintien n'est pas au lecteur", () => {
    const p = player({ overlay: true });

    p.send(holdRight("start"));
    expect(p.view.scrubbing).toBe(false);
  });
});

describe("défilement ouvert", () => {
  it("un appui déplace la cible ; OK valide ; les boutons de l'habillage sont avalés 400 ms", () => {
    const p = player({ overlay: true });

    p.controls.enterScrub();
    expect(p.view.scrubbing).toBe(true);
    p.send({ type: "select" });
    expect(p.view.scrubbing).toBe(true); // le jumeau de l'OK qui l'a ouvert
    vi.advanceTimersByTime(500);
    p.send(RIGHT);
    expect(p.view.target).toBe(1230);
    p.send({ type: "select" });
    expect(p.view.scrubbing).toBe(false);
    expect(p.log).toEqual(["scrubPause:true", "seek:1230", "scrubPause:false"]);
    const button = vi.fn();
    p.controls.guarded(button)();
    vi.advanceTimersByTime(400);
    p.controls.guarded(button)();
    expect(button).toHaveBeenCalledTimes(1);
  });

  it("entré en pause : aucune reprise seule ; annuler rend la pause, sans seek", () => {
    const p = player({ paused: true, overlay: true });

    p.controls.enterScrub();
    vi.advanceTimersByTime(60_000);
    expect(p.view.scrubbing).toBe(true);
    p.controls.scrub.cancelScrub();
    expect(p.log).toEqual(["scrubPause:true", "scrubPause:true"]);
  });
});

describe("panneau ouvert", () => {
  it("flèches, OK, ▶︎❙❙ et maintien sont au panneau", () => {
    const p = player({ panel: true, overlay: false, background: true });

    for (const intent of [RIGHT, LEFT, UP, { type: "select" }, { type: "playPause" }, holdRight("start")] as RemoteIntent[]) p.send(intent);
    expect(p.log).toEqual([]);
    expect(p.view.scrubbing).toBe(false);
  });
});

describe("le toucher du pavé", () => {
  it("réveille l'habillage, sauf dans les 600 ms qui suivent un appui", () => {
    const p = player({ overlay: false, background: true });

    p.send(RIGHT);
    vi.advanceTimersByTime(599);
    p.controls.wakeFromTouch();
    expect(p.view.overlay).toBe(false);
    vi.advanceTimersByTime(1);
    p.controls.wakeFromTouch();
    expect(p.view.overlay).toBe(true);
  });

  it("dit son régime : caché, affiché, ouvert", () => {
    const p = player({ overlay: false });
    expect(p.controls.readTouchMode()).toBe("hidden");
    p.view.overlay = true;
    expect(p.controls.readTouchMode()).toBe("shown");
    p.controls.enterScrub();
    expect(p.controls.readTouchMode()).toBe("open");
  });
});
