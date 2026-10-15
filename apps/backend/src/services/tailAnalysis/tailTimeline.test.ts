/**
 * La frise : l'alignement des cases d'image sur la grille des vignettes.
 */

import { describe, expect, it } from "vitest";
import { Timeline, count, type TailInput } from "./tailTimeline";

const input = (over: Partial<TailInput> = {}): TailInput => ({
  runtimeMs: 100_000,
  intervalMs: 10_000,
  cellsFromMs: 50_000,
  cells: "EETTK",
  providerSpans: [],
  ...over,
});

describe("Timeline", () => {
  it("lit la case d'image qui couvre un instant", () => {
    const t = new Timeline(input());
    expect(t.cell(49_999)).toBe("?");
    expect(t.cell(50_000)).toBe("E");
    expect(t.cell(79_999)).toBe("T");
    expect(t.cell(90_000)).toBe("K");
    expect(t.cell(100_000)).toBe("?");
  });

  it("les cases d'un intervalle partent de la grille, pas de l'instant demandé", () => {
    const t = new Timeline(input());
    expect(t.cellsBetween(65_000, 85_000)).toBe("ETT");
    expect(t.cellsBetween(70_000, 90_000)).toBe("TT");
  });

  it("le texte clair reste du texte : plus de son pour le trancher", () => {
    expect(new Timeline(input({ cells: "ELLEE" })).cellsBetween(50_000, 100_000)).toBe("ELLEE");
  });

  it("count compte les lettres d'une famille", () => {
    expect(count("TTCEKLU", "TLC")).toBe(4);
    expect(count("", "T")).toBe(0);
  });
});
