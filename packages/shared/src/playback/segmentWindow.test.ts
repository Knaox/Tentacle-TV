import { describe, expect, it } from "vitest";
import type { ResolvedSegment, SegmentType } from "./segmentTypes";
import { WINDOW_TAIL_MS, findActiveSegment, isInSegmentWindow, playbackPhase } from "./segmentWindow";

const seg = (
  type: SegmentType,
  startMs: number,
  endMs: number,
  extra?: Partial<Pick<ResolvedSegment, "endsAtMediaEnd" | "hasContentAfter">>,
): ResolvedSegment => ({
  type,
  startMs,
  endMs,
  source: "jellyfin",
  endsAtMediaEnd: extra?.endsAtMediaEnd ?? false,
  hasContentAfter: extra?.hasContentAfter ?? !(extra?.endsAtMediaEnd ?? false),
});

describe("isInSegmentWindow", () => {
  const intro = seg("Intro", 10_000, 90_000);

  it("rien tant que la lecture n'a pas démarré — l'intro commence souvent à 0", () => {
    expect(isInSegmentWindow({ segment: seg("Intro", 0, 90_000), positionMs: 0, hasStarted: false })).toBe(false);
  });

  it("le bord d'entrée est inclus, la dernière seconde est exclue", () => {
    expect(isInSegmentWindow({ segment: intro, positionMs: 10_000, hasStarted: true })).toBe(true);
    expect(isInSegmentWindow({ segment: intro, positionMs: 90_000 - WINDOW_TAIL_MS - 1, hasStarted: true })).toBe(true);
    expect(isInSegmentWindow({ segment: intro, positionMs: 90_000 - WINDOW_TAIL_MS, hasStarted: true })).toBe(false);
    expect(isInSegmentWindow({ segment: intro, positionMs: 9_999, hasStarted: true })).toBe(false);
  });

  it("segment absent : jamais", () => {
    expect(isInSegmentWindow({ segment: null, positionMs: 50_000, hasStarted: true })).toBe(false);
  });
});

describe("findActiveSegment", () => {
  it("un récap collé à l'intro : le récap parle d'abord", () => {
    const segments = [seg("Recap", 0, 30_000), seg("Intro", 20_000, 120_000)];
    expect(findActiveSegment(segments, 25_000, true)?.type).toBe("Recap");
    expect(findActiveSegment(segments, 40_000, true)?.type).toBe("Intro");
  });

  it("hors de toute fenêtre : null", () => {
    expect(findActiveSegment([seg("Intro", 0, 90_000)], 500_000, true)).toBeNull();
  });
});

describe("playbackPhase", () => {
  const segments = [
    seg("Recap", 0, 30_000),
    seg("Intro", 30_000, 120_000),
    seg("Outro", 1_300_000, 1_400_000, { hasContentAfter: true }),
  ];

  it("suit la position : IDLE, RECAP, INTRO, CONTENT, OUTRO, POST_CREDITS", () => {
    expect(playbackPhase(segments, 0, false)).toBe("IDLE");
    expect(playbackPhase(segments, 10_000, true)).toBe("RECAP");
    expect(playbackPhase(segments, 60_000, true)).toBe("INTRO");
    expect(playbackPhase(segments, 600_000, true)).toBe("CONTENT");
    expect(playbackPhase(segments, 1_350_000, true)).toBe("OUTRO");
    expect(playbackPhase(segments, 1_410_000, true)).toBe("POST_CREDITS");
  });

  it("générique jusqu'au bout : pas de phase post-générique", () => {
    const abruptEnd = [seg("Outro", 1_300_000, 1_440_000, { endsAtMediaEnd: true, hasContentAfter: false })];
    expect(playbackPhase(abruptEnd, 1_439_500, true)).toBe("CONTENT");
  });
});
