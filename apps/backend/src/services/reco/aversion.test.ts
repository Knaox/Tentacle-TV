import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import { aversionOf, universeAversion } from "./aversion";
import { buildCalibration, calibrationFit } from "./calibration";

const anchor = (key: string, kinds: Anchor["kinds"], weight = 1, hours = 2): Anchor => ({
  key, mediaType: "movie", tmdbId: 1, title: key, weight, consumption: weight > 0, hours, lastAt: null, kinds,
});
const facets: Record<string, string[]> = {
  a1: ["universe:anime"], a2: ["universe:anime"], d1: ["genre:18"], d2: ["genre:18"], ref: ["universe:franchise"],
};
const many = (prefix: string, n: number, kinds: Anchor["kinds"] = ["completed"]) =>
  Array.from({ length: n }, (_, i) => anchor(`${prefix}${i}`, kinds));
const facetsOf = (a: Anchor) => (facets[a.key] ?? facets[a.key.replace(/\d+$/, "1")] ?? []).map((key) => ({ key }));

describe("aversion apprise par l'exposition", () => {
  const exposure = { anime: 0.4, kidsAnimation: 0.1, franchise: 0.3 };

  it("un univers très offert et jamais regardé est évité ; un univers regardé ne l'est pas", () => {
    const watcher = universeAversion([...many("a", 6), ...many("d", 6)], facetsOf, exposure);
    expect(watcher.anime).toBe(0);
    const never = universeAversion(many("d", 12), facetsOf, exposure);
    expect(never.anime).toBeGreaterThan(0.9);
  });

  it("trois titres ne font pas une aversion ferme ; un refus compte contre son univers", () => {
    expect(universeAversion(many("d", 3), facetsOf, exposure).anime).toBeLessThan(0.3);
    const refused = universeAversion([...many("d", 12), anchor("ref", ["dismissed"], -0.6)], facetsOf, exposure);
    expect(refused.franchise).toBeGreaterThan(0.9);
  });

  it("un titre de deux univers prend le plus favorable (un Ghibli chez une famille)", () => {
    expect(aversionOf(["universe:anime", "universe:kids-animation"], { anime: 0.9, kidsAnimation: 0, franchise: 0 })).toBe(0);
    expect(aversionOf(["genre:18"], { anime: 0.9, kidsAnimation: 0, franchise: 0 })).toBe(0);
    // Un animé « franchise » chez qui adore les franchises mais évite l'animé : évité.
    expect(aversionOf(["universe:anime", "universe:franchise"], { anime: 0.9, kidsAnimation: 0, franchise: 0 })).toBe(0.9);
    expect(aversionOf(["universe:franchise"], { anime: 0, kidsAnimation: 0, franchise: 0.7 })).toBe(0.7);
  });
});

describe("calibration du compte", () => {
  it("dans les deux sens : le grand public pour qui le regarde, l'époque de ce qu'on regarde", () => {
    const blockbuster = buildCalibration([1, 2, 3, 4].map(() => ({ votes: 30_000, year: 2019, weight: 1 })))!;
    expect(calibrationFit(blockbuster, 26_000, 2018)).toBeGreaterThan(0.9);
    expect(calibrationFit(blockbuster, 300, 2018)).toBeLessThan(0.7);
    const modern = buildCalibration([1, 2, 3, 4].map(() => ({ votes: 3000, year: 2022, weight: 1 })))!;
    expect(calibrationFit(modern, 3000, 1992)).toBeLessThan(calibrationFit(modern, 3000, 2023));
  });

  it("trop peu de titres : aucune calibration", () => {
    expect(buildCalibration([{ votes: 10, year: 2020, weight: 1 }])).toBeNull();
  });
});
