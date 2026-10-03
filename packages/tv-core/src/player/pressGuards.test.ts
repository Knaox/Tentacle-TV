import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlayAutoHide, OVERLAY_HIDE_MS } from "./overlayAutoHide";
import {
  holdStillTicking, isScrubTwinPress, MEDIA_KEY_ECHO_MS, SCRUB_TWIN_PRESS_MS, scrubConfirmable, TOUCH_AFTER_PRESS_MS,
  touchFollowsPress,
} from "./pressGuards";

/** Les minuteurs injectés : ceux du moteur, que `vi.useFakeTimers` remplace. */
const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

describe("les gardes des appuis", () => {
  it("OK en défilement : refusé pendant l'écho d'une touche média (300 ms) et le jumeau d'un bouton (400 ms)", () => {
    expect(scrubConfirmable(1000, { lastMediaKeyAt: 1000 - MEDIA_KEY_ECHO_MS + 1, scrubStartedAt: 0 })).toBe(false);
    expect(scrubConfirmable(1000, { lastMediaKeyAt: 1000 - MEDIA_KEY_ECHO_MS, scrubStartedAt: 0 })).toBe(true);
    expect(scrubConfirmable(1000, { lastMediaKeyAt: 0, scrubStartedAt: 1000 - SCRUB_TWIN_PRESS_MS + 1 })).toBe(false);
    expect(scrubConfirmable(1000, { lastMediaKeyAt: 0, scrubStartedAt: 1000 - SCRUB_TWIN_PRESS_MS })).toBe(true);
  });

  it("le jumeau d'un OK après la fin d'un défilement, le toucher qui accompagne un appui, la queue d'un maintien", () => {
    expect(isScrubTwinPress(1399, 1000)).toBe(true);
    expect(isScrubTwinPress(1400, 1000)).toBe(false);
    expect(touchFollowsPress(1000 + TOUCH_AFTER_PRESS_MS - 1, 1000)).toBe(true);
    expect(touchFollowsPress(1000 + TOUCH_AFTER_PRESS_MS, 1000)).toBe(false);
    expect(holdStillTicking(true, 0, 0)).toBe(true);
    expect(holdStillTicking(false, 1399, 1000)).toBe(true);
    expect(holdStillTicking(false, 1400, 1000)).toBe(false);
  });
});

describe("l'extinction de l'habillage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("en lecture, 5 s après le dernier réveil ; jamais en pause ni panneau ouvert", () => {
    const seen: boolean[] = [];
    const hide = createOverlayAutoHide({ onVisible: (v) => seen.push(v), timers: TIMERS });

    hide.reveal({ paused: false, panelOpen: false });
    vi.advanceTimersByTime(3000);
    hide.reveal({ paused: false, panelOpen: false });
    vi.advanceTimersByTime(OVERLAY_HIDE_MS - 1);
    expect(seen.at(-1)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(seen.at(-1)).toBe(false);

    hide.reveal({ paused: true, panelOpen: false });
    hide.reveal({ paused: false, panelOpen: true });
    vi.advanceTimersByTime(60_000);
    expect(seen.at(-1)).toBe(true);
  });

  it("masqué tout de suite ; la minuterie seule peut s'arrêter", () => {
    const seen: boolean[] = [];
    const hide = createOverlayAutoHide({ onVisible: (v) => seen.push(v), timers: TIMERS });

    hide.reveal({ paused: false, panelOpen: false });
    hide.cancelTimer();
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual([true]);
    hide.hide();
    expect(seen).toEqual([true, false]);
  });
});
