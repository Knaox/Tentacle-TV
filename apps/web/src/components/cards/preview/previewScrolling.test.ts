import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCROLL_SETTLE_MS, createPreviewScrolling } from "./previewScrolling";

/**
 * Le défilement en cours : vrai dès le premier évènement, faux un temps franc
 * après le dernier — une seule minuterie par geste, une notification à chaque
 * bascule seulement (une session d'aperçu ne se re-rend pas à chaque image).
 */
describe("previewScrolling — le défilement en cours", () => {
  let clock = 0;
  const now = () => clock;
  const advance = (ms: number) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("démarre au premier évènement et s'arrête un temps franc après le dernier", () => {
    const scroll = createPreviewScrolling(now);
    expect(scroll.isScrolling()).toBe(false);
    scroll.onScroll();
    expect(scroll.isScrolling()).toBe(true);
    // Un geste continu : un évènement par image pendant 600 ms.
    for (let t = 0; t < 600; t += 16) {
      advance(16);
      scroll.onScroll();
    }
    expect(scroll.isScrolling()).toBe(true);
    advance(SCROLL_SETTLE_MS - 20);
    expect(scroll.isScrolling()).toBe(true);
    advance(40);
    expect(scroll.isScrolling()).toBe(false);
  });

  it("ne notifie qu'aux bascules, jamais à chaque évènement", () => {
    const scroll = createPreviewScrolling(now);
    let calls = 0;
    const stop = scroll.subscribe(() => {
      calls += 1;
    });
    for (let i = 0; i < 30; i++) {
      scroll.onScroll();
      advance(16);
    }
    advance(SCROLL_SETTLE_MS + 10);
    expect(calls).toBe(2);
    stop();
    scroll.onScroll();
    expect(calls).toBe(2);
  });

  it("une pause plus longue que le temps franc fait deux défilements", () => {
    const scroll = createPreviewScrolling(now);
    scroll.onScroll();
    advance(SCROLL_SETTLE_MS + 50);
    expect(scroll.isScrolling()).toBe(false);
    scroll.onScroll();
    expect(scroll.isScrolling()).toBe(true);
  });
});
