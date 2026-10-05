import { describe, expect, it } from "vitest";
import { initialRelease, nextRelease, ROW_STAGING, type StagedRow } from "./rowStaging";

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
    expect(initialRelease(1, 5)).toBe(5);
    expect(initialRelease(ROW_STAGING.headRows, 20)).toBe(0);
  });

  it("remplit la page de haut en bas — les têtes d'abord, puis les queues, quatre cartes par image", () => {
    const rows: StagedRow[] = [
      { rank: 0, total: 14, released: initialRelease(0, 14) },
      { rank: 1, total: 8, released: initialRelease(1, 8) },
      { rank: 2, total: 10, released: initialRelease(2, 10) },
      { rank: 3, total: 3, released: initialRelease(3, 3) },
    ];
    expect(play(rows)).toEqual(["2:4", "2:8", "3:3", "0:12", "0:14", "2:10"]);
    expect(rows.every((row) => row.released === row.total)).toBe(true);
  });

  it("n'a plus rien à monter quand tout l'est, et ne retire jamais rien", () => {
    expect(nextRelease([{ rank: 0, total: 4, released: 4 }])).toBeNull();
    expect(nextRelease([{ rank: 5, total: 2, released: 6 }])).toBeNull();
  });
});
