import { describe, expect, it } from "vitest";
import { createStagingPacer, initialRelease, nextRelease, ROW_STAGING, STAGING_PACE, type StagedRow } from "./rowStaging";

/** Joue l'échelonnement jusqu'au bout : la suite des parts. */
function play(rows: StagedRow[]): string[] {
  const steps: string[] = [];
  for (let next = nextRelease(rows); next; next = nextRelease(rows)) {
    const row = rows.find((r) => r.rank === next!.rank)!;
    row.released = next.released;
    steps.push(`${next.rank}:${next.released}`);
  }
  return steps;
}

describe("le montage échelonné des rangées", () => {
  it("monte d'emblée l'écran : les premières rangées, leurs premières cartes", () => {
    expect(initialRelease(0, 20)).toBe(ROW_STAGING.headCards);
    expect(initialRelease(0, 5)).toBe(5);
    expect(initialRelease(ROW_STAGING.headRows, 20)).toBe(0);
  });

  it("remplit la page de haut en bas — les têtes d'abord, puis les queues, deux cartes par image", () => {
    const rows: StagedRow[] = [
      { rank: 0, total: 12, released: initialRelease(0, 12) },
      { rank: 1, total: 4, released: initialRelease(1, 4) },
      { rank: 2, total: 10, released: initialRelease(2, 10) },
      { rank: 3, total: 3, released: initialRelease(3, 3) },
    ];
    expect(play(rows)).toEqual(["1:2", "1:4", "2:2", "2:4", "2:6", "2:8", "3:2", "3:3", "0:10", "0:12", "2:10"]);
    expect(rows.every((row) => row.released === row.total)).toBe(true);
  });

  it("monte d'abord ce qui manque à la rangée qui a le focus, queue comprise", () => {
    const rows: StagedRow[] = [
      { rank: 0, total: 12, released: 8, demanded: true },
      { rank: 1, total: 4, released: 0 },
    ];
    expect(play(rows)).toEqual(["0:10", "0:12", "1:2", "1:4"]);
  });

  it("n'a plus rien à monter quand tout l'est, et ne retire jamais rien", () => {
    expect(nextRelease([{ rank: 0, total: 4, released: 4 }])).toBeNull();
    expect(nextRelease([{ rank: 5, total: 2, released: 6 }])).toBeNull();
  });

  describe("le rythme des parts", () => {
    const interval = STAGING_PACE.intervalMs;

    it("une part par image tant que les images sont à l'heure", () => {
      const pacer = createStagingPacer();
      const frames = [0, 1, 2, 3, 4].map((n) => pacer.frame(n * interval));
      expect(frames).toEqual([true, true, true, true, true]);
    });

    it("attend l'image suivante après une image en retard, jamais plus de maxWaitMs", () => {
      const pacer = createStagingPacer();
      expect(pacer.frame(0)).toBe(true);
      // La part a retenu le fil UI : l'image suivante arrive en retard.
      expect(pacer.frame(2 * interval)).toBe(false);
      expect(pacer.frame(3 * interval)).toBe(true);
      // Des images toutes en retard : une part quand même, passé maxWaitMs.
      const late = interval * 2;
      let now = 3 * interval;
      const released: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        now += late;
        released.push(pacer.frame(now));
      }
      expect(released).toEqual([false, true, false, true]);
    });
  });
});

