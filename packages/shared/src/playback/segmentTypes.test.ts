import { describe, expect, it } from "vitest";
import { parsePlaybackSegmentsResponse } from "./segmentTypes";

const CONTRAT = {
  version: 1,
  itemId: "ep-1",
  runtimeMs: 1_440_000,
  resolvedAt: "2026-08-28T00:00:00.000Z",
  segments: [
    {
      type: "Intro",
      startMs: 0,
      endMs: 90_000,
      source: "jellyfin",
      endsAtMediaEnd: false,
      hasContentAfter: true,
    },
  ],
};

describe("parsePlaybackSegmentsResponse", () => {
  it("relit un contrat valide tel quel", () => {
    expect(parsePlaybackSegmentsResponse(CONTRAT)).toEqual(CONTRAT);
  });

  it("refuse ce qui n'est pas le contrat : autre version, forme étrangère", () => {
    expect(parsePlaybackSegmentsResponse(null)).toBeNull();
    expect(parsePlaybackSegmentsResponse("<html>proxy</html>")).toBeNull();
    expect(parsePlaybackSegmentsResponse({ ...CONTRAT, version: 2 })).toBeNull();
    // L'ANCIEN format du snapshot (trois clés brutes) n'est pas le contrat.
    expect(
      parsePlaybackSegmentsResponse({ mediaSegments: null, pluginDict: null, pluginTs: null }),
    ).toBeNull();
  });

  it("écarte les segments illisibles un à un, sans jeter la réponse", () => {
    const relu = parsePlaybackSegmentsResponse({
      ...CONTRAT,
      runtimeMs: "vingt-quatre minutes",
      segments: [
        ...CONTRAT.segments,
        { type: "Banana", startMs: 0, endMs: 10 },
        { type: "Outro", startMs: 100, endMs: 50 },
        null,
      ],
    });
    expect(relu).not.toBeNull();
    expect(relu?.segments).toEqual(CONTRAT.segments);
    expect(relu?.runtimeMs).toBe(0);
  });
});
