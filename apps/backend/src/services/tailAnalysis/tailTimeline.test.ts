/**
 * La frise : l'alignement des cases d'image et de son, et le texte clair que
 * le son tranche.
 */

import { describe, expect, it } from "vitest";
import { Timeline, count, type TailInput } from "./tailTimeline";

const input = (over: Partial<TailInput> = {}): TailInput => ({
  runtimeMs: 100_000,
  intervalMs: 10_000,
  cellsFromMs: 50_000,
  cells: "EETTK",
  audio: { fromMs: 60_000, classes: "SSSSSSSSSSMMMMMMMMMMQQQQQQQQQQ????" },
  providerSpans: [],
  ...over,
});

describe("Timeline", () => {
  it("lit la case d'image et la seconde de son qui couvrent un instant", () => {
    const t = new Timeline(input());
    expect(t.cell(49_999)).toBe("?");
    expect(t.cell(50_000)).toBe("E");
    expect(t.cell(79_999)).toBe("T");
    expect(t.cell(90_000)).toBe("K");
    expect(t.cell(100_000)).toBe("?");
    expect(t.sound(59_000)).toBe("?");
    expect(t.sound(60_500)).toBe("S");
    expect(t.sound(70_000)).toBe("M");
    expect(t.hasAudio).toBe(true);
  });

  it("les cases d'un intervalle partent de la grille, pas de l'instant demandé", () => {
    const t = new Timeline(input());
    expect(t.cellsBetween(65_000, 85_000)).toBe("ETT");
    expect(t.cellsBetween(70_000, 90_000)).toBe("TT");
  });

  it("parts et plages du son", () => {
    const t = new Timeline(input());
    expect(t.share(60_000, 80_000, "S")).toBe(0.5);
    expect(t.share(80_000, 90_000, "Q")).toBe(1);
    expect(t.soundRuns()).toEqual([
      [60_000, 70_000, "S"],
      [70_000, 80_000, "M"],
      [80_000, 90_000, "Q"],
      [90_000, 94_000, "?"],
    ]);
    expect(new Timeline(input({ audio: null })).soundRuns()).toEqual([]);
  });

  it("le texte clair sous un dialogue est une image (« Rick et Morty ») ; sous la musique, du générique", () => {
    const t = new Timeline(input({ cells: "ELLEE" }));
    // Case 60-70 s : parole → E ; case 70-80 s : musique → L.
    expect(t.cellsBetween(50_000, 100_000)).toBe("EELEE");
    // Sans audio, rien ne tranche : on garde le texte.
    expect(new Timeline(input({ cells: "ELLEE", audio: null })).cellsBetween(50_000, 100_000)).toBe("ELLEE");
  });

  it("count compte les lettres d'une famille", () => {
    expect(count("TTCEKLU", "TLC")).toBe(4);
    expect(count("", "T")).toBe(0);
  });
});
