import { describe, expect, it } from "vitest";
import { droppedIn, formatIntroFrameReport, introFramePeriod, introFrameReport } from "./introFrames";

const ASSEMBLY = 0;
const HOLD = 1;
const DIVE = 2;
const SETTLE = 3;
const log = (phase: number, gaps: number[]) => gaps.flatMap((gap) => [phase, gap]);

describe("le compte des images de l'ouverture", () => {
  it("reconnaît la fréquence de l'écran malgré la gigue et les images perdues", () => {
    expect(introFramePeriod([16.6, 16.8, 16.7, 33.4, 16.5])).toBeCloseTo(1000 / 60, 6);
    expect(introFramePeriod([8.4, 8.3, 8.2, 16.7, 8.4, 8.3, 8.3, 8.4, 8.3, 25])).toBeCloseTo(1000 / 120, 6);
    expect(introFramePeriod([])).toBeCloseTo(1000 / 60, 6);
  });

  it("une image en retard d'un pas complet est une image perdue ; la gigue n'en est pas une", () => {
    const period = 1000 / 60;
    expect(droppedIn(17.9, period)).toBe(0);
    expect(droppedIn(33.4, period)).toBe(1);
    expect(droppedIn(1000, period)).toBe(59);
  });

  it("fait le bilan par phase : une plongée qui fige une seconde se voit", () => {
    const steady = Array.from({ length: 60 }, () => 16.7);
    const report = introFrameReport([...log(ASSEMBLY, steady), ...log(HOLD, steady), ...log(DIVE, [16.7, 1000, 16.7])]);
    expect(report.hz).toBe(60);
    expect(report.phases.assembly).toMatchObject({ frames: 60, dropped: 0, worstMs: 16.7 });
    expect(report.phases.dive.dropped).toBe(59);
    expect(report.total.dropped).toBe(59);
    expect(report.total.worstMs).toBe(1000);
  });

  it("une ouverture parfaite à 120 Hz : aucune image perdue", () => {
    const steady = Array.from({ length: 120 }, (_, index) => (index % 2 ? 8.2 : 8.5));
    const report = introFrameReport([...log(ASSEMBLY, steady), ...log(DIVE, steady)]);
    expect(report.hz).toBe(120);
    expect(report.total).toMatchObject({ frames: 240, dropped: 0, worstMs: 8.5 });
    expect(formatIntroFrameReport(report)).toContain("120 Hz — 240 images, 0 perdues");
  });

  it("l'encre immobile du début ne compte pas : ses trous ne se voient pas", () => {
    const report = introFrameReport([...log(SETTLE, [16.7, 600, 16.7]), ...log(ASSEMBLY, Array.from({ length: 30 }, () => 16.7))]);
    expect(report.total).toMatchObject({ frames: 30, dropped: 0 });
    expect(report.phases.settle).toMatchObject({ frames: 3, worstMs: 600 });
    expect(report.phases.settle.durationMs).toBeCloseTo(633.4, 6);
    expect(formatIntroFrameReport(report)).toContain("encre 633 ms, pire 600 ms");
  });
});
