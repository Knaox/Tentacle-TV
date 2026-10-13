import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import type { Candidate } from "./scoring/strategy";
import { themeAversion, themeAversionOf } from "./themeAversion";

const anchor = (key: string): Anchor => ({ key, mediaType: "tv", tmdbId: 1, title: key, weight: 1, consumption: true, hours: 5, lastAt: null, kinds: ["series"] });
const cand = (key: string, keys: string[]): Candidate => ({
  key, mediaType: "tv", tmdbId: 1, title: key, year: 2025, facets: keys.map((k) => ({ key: k, mult: 1 })),
  voteAverage: 8, voteCount: 50, popularity: 1, source: "library", jellyfinItemId: key,
});

describe("aversion par l'exposition, au grain des thèmes", () => {
  // Une bibliothèque pleine d'isekai ; un compte qui n'en regarde pas.
  const library = [
    ...Array.from({ length: 20 }, (_, i) => cand(`i${i}`, ["kw:isekai", "kw:reincarnation"])),
    ...Array.from({ length: 20 }, (_, i) => cand(`d${i}`, ["kw:drama"])),
  ];
  const watched = Array.from({ length: 12 }, (_, i) => anchor(`w${i}`));
  const facetsOf = () => [{ key: "kw:drama" }];

  it("un thème dense jamais regardé est évité ; un thème regardé ne l'est pas ; un thème rare ne dit rien", () => {
    const themes = themeAversion(watched, facetsOf, library);
    expect(themes.get("kw:isekai")).toBeGreaterThan(0.9);
    expect(themes.has("kw:drama")).toBe(false);
    expect(themeAversion(watched, facetsOf, [...library, cand("x", ["kw:rare"])]).has("kw:rare")).toBe(false);
  });

  it("il faut deux thèmes évités pour peser (un seul ne condamne pas)", () => {
    const themes = themeAversion(watched, facetsOf, library);
    expect(themeAversionOf(["kw:isekai", "kw:reincarnation"], themes)).toBeGreaterThan(0.9);
    expect(themeAversionOf(["kw:isekai", "kw:drama"], themes)).toBe(0);
  });
});
