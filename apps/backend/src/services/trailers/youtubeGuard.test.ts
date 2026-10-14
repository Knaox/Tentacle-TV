/**
 * Le garde-fou des aperçus : le disjoncteur (30 min, doublées à chaque
 * rechute jusqu'à 4 h, remises à zéro au premier succès) et le budget de 30
 * extractions d'aperçu par heure glissante. Le temps est passé en argument.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_EXTRACTIONS_PER_HOUR, countPreviewExtraction, previewRefusal, recordYouTubeSuccess, resetYouTubeGuard, tripYouTubeBreaker,
} from "./youtubeGuard";

const MIN = 60_000;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetYouTubeGuard();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("disjoncteur", () => {
  it("s'ouvre 30 min, puis 60, 120, 240 — et pas au-delà de 4 h", () => {
    let now = 0;
    for (const expected of [30, 60, 120, 240, 240]) {
      tripYouTubeBreaker("bot", now);
      expect(previewRefusal(now)).toEqual({ kind: "blocked", remainingMs: expected * MIN });
      expect(previewRefusal(now + expected * MIN)).toBeNull();
      now += expected * MIN;
    }
    expect(warn).toHaveBeenNthCalledWith(1, "[trailers] YouTube demande une vérification anti-robot — aperçus suspendus 30 min");
    expect(warn).toHaveBeenNthCalledWith(4, "[trailers] YouTube demande une vérification anti-robot — aperçus suspendus 240 min");
  });

  it("ouvert, il ne se prolonge pas pour des échecs simultanés", () => {
    tripYouTubeBreaker("limit", 0);
    tripYouTubeBreaker("bot", 10 * MIN);
    expect(previewRefusal(10 * MIN)).toEqual({ kind: "blocked", remainingMs: 20 * MIN });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[trailers] YouTube limite les demandes de ce serveur — aperçus suspendus 30 min");
  });

  it("la première extraction réussie le referme et le remet à 30 min", () => {
    tripYouTubeBreaker("bot", 0);
    tripYouTubeBreaker("bot", 30 * MIN);
    recordYouTubeSuccess(40 * MIN);
    expect(previewRefusal(40 * MIN)).toBeNull();
    tripYouTubeBreaker("bot", 50 * MIN);
    expect(previewRefusal(50 * MIN)).toEqual({ kind: "blocked", remainingMs: 30 * MIN });
  });
});

describe("budget des aperçus", () => {
  it("30 extractions par heure glissante ; la suivante attend la place la plus ancienne", () => {
    for (let i = 0; i < PREVIEW_EXTRACTIONS_PER_HOUR; i++) {
      expect(previewRefusal(i * MIN)).toBeNull();
      countPreviewExtraction(i * MIN);
    }
    expect(PREVIEW_EXTRACTIONS_PER_HOUR).toBe(30);
    expect(previewRefusal(40 * MIN)).toEqual({ kind: "budget", retryAfterMs: 20 * MIN });
    // Une heure après la première, une place se libère.
    expect(previewRefusal(60 * MIN)).toBeNull();
    expect(warn).toHaveBeenCalledWith("[trailers] aperçus : 30 extractions dans l'heure — les suivantes attendent 20 min");
  });

  it("le disjoncteur passe avant le budget", () => {
    for (let i = 0; i < PREVIEW_EXTRACTIONS_PER_HOUR; i++) countPreviewExtraction(0);
    tripYouTubeBreaker("bot", 0);
    expect(previewRefusal(0)?.kind).toBe("blocked");
  });
});
