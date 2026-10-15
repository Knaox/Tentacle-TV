/**
 * Les cas spéciaux du banc du 28 septembre 2026 (267 titres) que l'image seule
 * tranche : la dernière image connue, et les logos de fin reconnus à leur fond
 * clair. (Le générique illustré, l'aperçu du prochain épisode et le marqueur
 * tombé dans le film ne se lisaient qu'au son : l'analyse audio est retirée.)
 */

import { describe, expect, it } from "vitest";
import { isCreditsChapterName } from "../../playback/segmentChapters";
import { readTail } from "./tailReading";
import { Timeline, type TailInput } from "./tailTimeline";

type Strip = Array<[string, number]>;

const strip = (parts: Strip, stepS: number): string =>
  parts.map(([letter, seconds]) => letter.repeat(seconds / stepS)).join("");

const LOOKS: Record<string, { dark: number; modal: number }> = {
  f: { dark: 0.01, modal: 0.8 },
  k: { dark: 1, modal: 1 },
  n: { dark: 0.2, modal: 0.2 },
};

describe("les noms de chapitre", () => {
  it("« End Titles » est un générique de fin, « Opening Credits » non", () => {
    expect(isCreditsChapterName("End Titles")).toBe(true);
    expect(isCreditsChapterName("End Credits")).toBe(true);
    expect(isCreditsChapterName("Générique de fin")).toBe(true);
    expect(isCreditsChapterName("Opening Credits")).toBe(false);
    expect(isCreditsChapterName("Without Incident")).toBe(false);
  });
});

describe("la dernière image connue", () => {
  const input = (runtimeS: number, picture: Strip): TailInput => ({
    runtimeMs: runtimeS * 1000,
    intervalMs: 10_000,
    cellsFromMs: (runtimeS / 2) * 1000,
    cells: strip(picture, 10),
    providerSpans: [],
  });

  it("des sous-titres plus longs que la vidéo allongent le fichier : la fin est celle de l'image", () => {
    expect(new Timeline(input(3240, [["E", 1500], ["K", 20]])).knownEndMs).toBe(3_140_000);
    expect(new Timeline(input(3240, [["E", 1620]])).knownEndMs).toBe(3_240_000);
  });
});

/** Un film qui finit sur son défilement (5600-6000 s), puis `tail` jusqu'au bout — cases alignées sur la seconde 3000. */
const ending = (tail: { picture: Strip; looks: Strip }): TailInput => {
  const tailS = tail.picture.reduce((n, [, sec]) => n + sec, 0);
  return {
    runtimeMs: (6000 + tailS) * 1000,
    intervalMs: 10_000,
    cellsFromMs: 3_000_000,
    cells: strip([["E", 2600], ["T", 400], ...tail.picture], 10),
    providerSpans: [],
    measures: [...strip([["n", 3000], ...tail.looks], 10)].map((l) => LOOKS[l]),
  };
};

describe("les logos de fin", () => {
  it("le château Disney puis la lampe Pixar sur son fond clair : pas une scène (« Toy Story »)", () => {
    const reading = readTail(ending({ picture: [["E", 20], ["K", 10]], looks: [["n", 10], ["f", 10], ["k", 10]] }));
    expect(reading?.scenes).toEqual([]);
  });

  it("quarante secondes de gag sur le logo, puis un fondu au noir : toujours un logo (« WALL·E »)", () => {
    const reading = readTail(ending({ picture: [["E", 40], ["K", 10]], looks: [["n", 10], ["f", 30], ["k", 10]] }));
    expect(reading?.scenes).toEqual([]);
  });

  it("le château Disney du centenaire (40 s) puis la lampe Pixar : un logo (« Toy Story 5 »)", () => {
    const reading = readTail(ending({ picture: [["E", 40], ["U", 10], ["K", 10]], looks: [["n", 40], ["f", 10], ["k", 10]] }));
    expect(reading?.scenes).toEqual([]);
  });

  it("une longue plage qui ne finit pas sur le fond clair reste une scène", () => {
    const reading = readTail(ending({ picture: [["E", 90], ["K", 30]], looks: [["n", 90], ["k", 30]] }));
    expect(reading?.scenes).toHaveLength(1);
  });
});
