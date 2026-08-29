import { describe, expect, it } from "vitest";
import { parsePlaybackSegmentsResponse } from "./segmentTypes";

const CONTRACT = {
  version: 1,
  itemId: "ep-1",
  runtimeMs: 1_440_000,
  libraryId: "lib-series",
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
    expect(parsePlaybackSegmentsResponse(CONTRACT)).toEqual(CONTRACT);
  });

  it("refuse ce qui n'est pas le contrat : autre version, forme étrangère", () => {
    expect(parsePlaybackSegmentsResponse(null)).toBeNull();
    expect(parsePlaybackSegmentsResponse("<html>proxy</html>")).toBeNull();
    expect(parsePlaybackSegmentsResponse({ ...CONTRACT, version: 2 })).toBeNull();
    // L'ANCIEN format du snapshot (trois clés brutes) n'est pas le contrat.
    expect(
      parsePlaybackSegmentsResponse({ mediaSegments: null, pluginDict: null, pluginTs: null }),
    ).toBeNull();
  });

  it("écarte les segments illisibles un à un, sans jeter la réponse", () => {
    const reread = parsePlaybackSegmentsResponse({
      ...CONTRACT,
      runtimeMs: "vingt-quatre minutes",
      segments: [
        ...CONTRACT.segments,
        { type: "Banana", startMs: 0, endMs: 10 },
        { type: "Outro", startMs: 100, endMs: 50 },
        null,
      ],
    });
    expect(reread).not.toBeNull();
    expect(reread?.segments).toEqual(CONTRACT.segments);
    expect(reread?.runtimeMs).toBe(0);
  });
});

describe("libraryId — le champ additif", () => {
  it("un snapshot d'AVANT, qui ne le porte pas, se relit et vaut null", () => {
    const { libraryId: _ignored, ...ancien } = CONTRACT;
    expect(parsePlaybackSegmentsResponse(ancien)?.libraryId).toBeNull();
  });

  it("une valeur vide vaut null — le seuil global s'appliquera", () => {
    expect(parsePlaybackSegmentsResponse({ ...CONTRACT, libraryId: "" })?.libraryId).toBeNull();
    expect(parsePlaybackSegmentsResponse({ ...CONTRACT, libraryId: 42 })?.libraryId).toBeNull();
  });
});
