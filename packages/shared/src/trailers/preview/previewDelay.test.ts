import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAILER_PREVIEW_DELAY, TRAILER_PREVIEW_DELAYS, WEB_TRAILER_PREVIEW_PACE, parseTrailerPreviewDelay, trailerPreviewTimingFor,
} from "./previewDelay";
import { TRAILER_PREVIEW_TIMING } from "./previewTiming";

describe("le délai de l'aperçu", () => {
  it("800 ms par défaut, et seulement des choix offerts", () => {
    expect(DEFAULT_TRAILER_PREVIEW_DELAY).toBe(800);
    expect(TRAILER_PREVIEW_DELAYS).toContain(DEFAULT_TRAILER_PREVIEW_DELAY);
    expect(parseTrailerPreviewDelay("1200")).toBe(1200);
    expect(parseTrailerPreviewDelay(2000)).toBe(2000);
    for (const raw of [null, undefined, "", "abc", "700", 0, -800, Number.NaN]) expect(parseTrailerPreviewDelay(raw)).toBe(800);
  });

  it("la première image au délai, la demande avant lui (web : 400 ms d'avance)", () => {
    const timing = trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 800, WEB_TRAILER_PREVIEW_PACE);
    expect(timing).toMatchObject({ revealMs: 800, intentMs: 400, intentStillMs: TRAILER_PREVIEW_TIMING.intentStillMs });
    expect(trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 2000, WEB_TRAILER_PREVIEW_PACE)).toMatchObject({ revealMs: 2000, intentMs: 1600 });
  });

  it("jamais de demande avant le plancher (le défilement rapide ne demande rien), ni après le délai", () => {
    expect(trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 500, WEB_TRAILER_PREVIEW_PACE)).toMatchObject({ revealMs: 500, intentMs: 200 });
    expect(trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 500, { floorMs: 450, leadMs: 100 })).toMatchObject({ revealMs: 500, intentMs: 450 });
    expect(trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 500, { floorMs: 900, leadMs: 100 })).toMatchObject({ revealMs: 500, intentMs: 500 });
  });

  it("un délai illisible vaut le défaut", () => {
    expect(trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, 123, WEB_TRAILER_PREVIEW_PACE).revealMs).toBe(800);
  });
});
