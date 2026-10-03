import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createArrowHold, HOLD_FROM_DOWN_ENGAGE_MS, HOLD_FROM_DOWN_SCRUB_MS, type ArrowHoldHost, type ScrubInputProfile } from "./arrowHold";
import { HOLD_TICK_MS } from "./holdTiming";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Les deux profils du lecteur d'`apps/tv` (`scrubInput.ios.ts`, `scrubInput.ts`). */
const TVOS: ScrubInputProfile = { tapOnRelease: false, holdFromKeyDown: false, holdArmMs: 0, holdEndAnnounced: true };
const ANDROID: ScrubInputProfile = { tapOnRelease: true, holdFromKeyDown: true, holdArmMs: 250, holdEndAnnounced: false };

function harness(profile: ScrubInputProfile, state: { scrubbing?: boolean; panel?: boolean; overlay?: boolean } = {}) {
  const s = { scrubbing: false, panel: false, overlay: false, ...state };
  const calls: string[] = [];
  const host: ArrowHoldHost = {
    isScrubbing: () => s.scrubbing,
    isPanelOpen: () => s.panel,
    isOverlayVisible: () => s.overlay,
    stepScrub: (dir) => calls.push(`step:${dir}`),
    tickScrub: (dir, tier) => calls.push(`tick:${dir}:${tier}`),
    onEngage: () => {
      s.scrubbing = true;
      calls.push("engage");
    },
    onTap: (dir) => calls.push(`tap:${dir}`),
    onHoldEnd: () => calls.push("holdEnd"),
  };
  return { s, calls, hold: createArrowHold(profile, host, TIMERS) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Apple TV : le maintien est annoncé", () => {
  it("engage aussitôt, accélère d'un palier par seconde, s'arrête au relâchement", () => {
    const { calls, hold } = harness(TVOS);

    hold.handleLongDirection("forward");
    expect(calls).toEqual(["engage"]);
    vi.advanceTimersByTime(HOLD_TICK_MS * 4);
    vi.advanceTimersByTime(1000);
    expect(calls.filter((c) => c.startsWith("tick")).slice(0, 3)).toEqual(Array(3).fill("tick:forward:1"));
    expect(calls.filter((c) => c === "tick:forward:2")).toHaveLength(4);
    hold.onHoldRelease();
    const ticks = calls.length;
    vi.advanceTimersByTime(5000);
    expect(calls.length).toBe(ticks);
    expect(calls.at(-1)).toBe("holdEnd");
    hold.destroy();
  });

  it("habillage affiché ou panneau ouvert : le maintien n'est pas au lecteur", () => {
    expect(((h) => (h.hold.handleLongDirection("forward"), h.calls))(harness(TVOS, { overlay: true }))).toEqual([]);
    expect(((h) => (h.hold.handleLongDirection("backward"), h.calls))(harness(TVOS, { panel: true }))).toEqual([]);
  });

  it("tient les appuis directionnels pendant le tic et 400 ms après", () => {
    const { hold } = harness(TVOS);

    hold.handleLongDirection("forward");
    expect(hold.isHoldTicking()).toBe(true);
    vi.advanceTimersByTime(300);
    hold.onHoldRelease();
    expect(hold.isHoldTicking()).toBe(true);
    vi.advanceTimersByTime(399);
    expect(hold.isHoldTicking()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hold.isHoldTicking()).toBe(false);
    hold.destroy();
  });
});

describe("Android TV : le maintien se déduit", () => {
  it("signal natif d'appui long : engage 250 ms plus tard", () => {
    const { calls, hold } = harness(ANDROID);

    hold.handleLongDirection("backward");
    vi.advanceTimersByTime(249);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["engage"]);
    hold.destroy();
  });

  it("key-down sans key-up : engage à 550 ms, à 400 ms défilement ouvert", () => {
    const fromPlay = harness(ANDROID);
    fromPlay.hold.armHoldFromDown("forward");
    vi.advanceTimersByTime(HOLD_FROM_DOWN_ENGAGE_MS - 1);
    expect(fromPlay.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fromPlay.calls).toEqual(["engage"]);
    fromPlay.hold.destroy();

    const inScrub = harness(ANDROID, { scrubbing: true });
    inScrub.hold.armHoldFromDown("forward");
    vi.advanceTimersByTime(HOLD_FROM_DOWN_SCRUB_MS);
    expect(inScrub.calls).toEqual(["engage"]);
    inScrub.hold.destroy();
  });

  it("relu au déclenchement : l'habillage paru entre-temps annule l'engagement", () => {
    const { s, calls, hold } = harness(ANDROID);

    hold.armHoldFromDown("forward");
    s.overlay = true;
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([]);
  });

  it("un appui se tranche au relâchement : le saut part alors", () => {
    const { calls, hold } = harness(ANDROID);

    hold.armHoldFromDown("forward");
    hold.requestDeferredTap("forward");
    vi.advanceTimersByTime(100);
    hold.onHoldRelease();
    expect(calls).toEqual(["holdEnd", "tap:forward"]);
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual(["holdEnd", "tap:forward"]);
  });

  it("touche média : un appui isolé fait un pas sec, la répétition engage le tic", () => {
    const { calls, hold } = harness(ANDROID, { scrubbing: true });

    hold.mediaPulse("forward");
    expect(calls).toEqual(["step:forward"]);
    vi.advanceTimersByTime(100);
    hold.mediaPulse("forward");
    vi.advanceTimersByTime(100);
    hold.mediaPulse("forward");
    vi.advanceTimersByTime(HOLD_TICK_MS);
    expect(calls).toContain("tick:forward:1");
    hold.stopAll();
    hold.destroy();
  });
});
