import { describe, expect, it } from "vitest";
import { TRAILER_PREVIEW_DELAYS } from "@tentacle-tv/shared";
import { PREVIEW_SESSION_DWELL_MS, previewSessionDwellLeft } from "./trailerPreviewDwell";
import { tvTrailerPreviewTiming } from "./trailerPreviewTv";

describe("PREVIEW_SESSION_DWELL_MS — la session ne naît qu'au focus tenu", () => {
  it("reste sous le plancher de la demande, pour chaque délai réglable : le rythme ne change pas", () => {
    for (const delay of TRAILER_PREVIEW_DELAYS) {
      expect(PREVIEW_SESSION_DWELL_MS).toBeLessThan(tvTrailerPreviewTiming(delay).intentMs);
    }
  });

  it("ce qu'il reste à attendre, depuis l'arrivée du focus", () => {
    expect(previewSessionDwellLeft(1_000, 1_000)).toBe(PREVIEW_SESSION_DWELL_MS);
    expect(previewSessionDwellLeft(1_000, 1_100)).toBe(PREVIEW_SESSION_DWELL_MS - 100);
    expect(previewSessionDwellLeft(1_000, 5_000)).toBe(0);
  });
});
