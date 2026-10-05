import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactSawPress } from "./pressGuards";
import { canEngage, type TouchMode } from "./scrubTouchTuning";
import { createTouchScrub } from "./touchScrub";

/**
 * Le CLIC n'est pas un glisser (retour d'essai, Apple TV 1.10.1) : sous la
 * pilule « Passer l'intro », OK lançait une recherche dans la vidéo ou
 * ouvrait la barre de lecture — le pavé de la Siri Remote glisse toujours un
 * peu sous un doigt qui se pose puis s'enfonce.
 */

const TIMERS = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function harness(mode: TouchMode) {
  const calls: string[] = [];
  let lastPressAt = 0;
  const touch = createTouchScrub({
    readTouchMode: () => mode,
    onTouchStart: () => calls.push("touch"),
    onStartScrub: () => calls.push("start"),
    onNudgeScrub: () => calls.push("nudge"),
    onEndScrub: () => calls.push("end"),
    onWake: () => calls.push("wake"),
    readDuration: () => 3000,
    readLastPressAt: () => lastPressAt,
  }, TIMERS);
  const slide = (from: number, dx: number, ms: number, vx: number) => {
    const n = Math.round(ms / 16);
    for (let i = 1; i <= n; i++) {
      vi.advanceTimersByTime(16);
      touch.drag("move", from + Math.round((dx * i) / n), 0, vx);
    }
  };
  const press = () => { lastPressAt = Date.now(); };
  return { calls, touch, slide, press };
}

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe("le pavé tenu par la pilule de saut", () => {
  it("aucune course n'engage, quel que soit le contact tenu", () => {
    for (const dx of [0, 60, 400, 1920]) {
      expect(canEngage("held", dx, 0, 0)).toBe(false);
      expect(canEngage("held", -dx, 0, 5000)).toBe(false);
    }
  });

  it("doigt posé 700 ms (il dérive) puis glissé de 300 points : rien ne défile, le toucher réveille", () => {
    const h = harness("held");

    h.touch.drag("start", 0, 0, 0);
    h.slide(0, 20, 700, 30);
    h.slide(20, 300, 400, 700);
    h.touch.drag("end", 300, 0, 0);
    expect(h.calls).toEqual(["touch", "wake"]);
  });

  it("les autres régimes engagent comme avant", () => {
    expect(canEngage("hidden", 60, 0, 600)).toBe(true);
    expect(canEngage("shown", 60, 0, 180)).toBe(true);
    expect(canEngage("open", 12, 0, 0)).toBe(true);
  });
});

describe("un contact qui voit un appui est un clic", () => {
  it("contactSawPress : l'appui pendant le contact compte, celui d'avant la pose non", () => {
    expect(contactSawPress(1000, 0)).toBe(false);
    expect(contactSawPress(1000, 999)).toBe(false);
    expect(contactSawPress(1000, 1000)).toBe(true);
    expect(contactSawPress(1000, 1500)).toBe(true);
  });

  it("habillage caché : doigt posé, clic, le doigt glisse ensuite — ni défilement ni réveil", () => {
    const h = harness("hidden");

    h.touch.drag("start", 0, 0, 0);
    h.slide(0, 10, 300, 30);
    h.press();
    h.slide(10, 200, 600, 700);
    h.touch.drag("end", 210, 0, 0);
    expect(h.calls).toEqual(["touch"]);
  });

  it("habillage affiché : un clic pris dans un geste annulé ne défile pas à sa reprise", () => {
    const h = harness("shown");

    h.touch.drag("start", 0, 0, 0);
    vi.advanceTimersByTime(100);
    h.press();
    // tvOS annule le pan au clic : silence, puis le doigt resté posé repart.
    vi.advanceTimersByTime(1000);
    h.slide(0, 300, 400, 700);
    h.touch.drag("end", 300, 0, 0);
    expect(h.calls).not.toContain("start");
  });

  it("un appui AVANT la pose n'empêche pas le glisser suivant", () => {
    const h = harness("shown");

    h.press();
    vi.advanceTimersByTime(300);
    h.touch.drag("start", 0, 0, 0);
    h.slide(0, 300, 400, 700);
    h.touch.drag("end", 300, 0, 0);
    expect(h.calls).toContain("start");
  });

  it("défilement ouvert : le doigt qui vise reprend même après un appui (OK y valide)", () => {
    const h = harness("open");

    h.touch.drag("start", 0, 0, 0);
    h.press();
    h.slide(0, 60, 200, 300);
    expect(h.calls).toContain("start");
  });
});
