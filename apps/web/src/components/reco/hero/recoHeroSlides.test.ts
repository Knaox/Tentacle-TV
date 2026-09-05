import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { heroSelectionFromRows, selectHeroSlides } from "./recoHeroSlides";

const item = (key: string, backdrop: boolean, jellyfin = false): RecoRowItem => ({
  key,
  mediaType: "movie",
  tmdbId: Number(key.split(":")[1]),
  title: key,
  year: null,
  posterPath: null,
  backdropPath: backdrop ? `/b${key}.jpg` : null,
  jellyfinItemId: jellyfin ? `jf-${key}` : null,
  source: "x",
  score: 1,
  voteAverage: null,
  reasons: [],
});

/** Vingt items à visuel large, deux sans rien, un de bibliothèque sans backdrop. */
const ITEMS: RecoRowItem[] = [
  item("movie:100", false),
  ...Array.from({ length: 20 }, (_, i) => item(`movie:${i + 1}`, true)),
  item("movie:101", false),
  item("movie:102", false, true),
];
const ELIGIBLE = new Set(ITEMS.filter((i) => i.backdropPath || i.jellyfinItemId).map((i) => i.key));

describe("selectHeroSlides", () => {
  it("tire cinq items au plus, tous à visuel large, sans doublon", () => {
    const picked = selectHeroSlides(ITEMS, 0.42);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((s) => s.key)).size).toBe(5);
    for (const s of picked) expect(ELIGIBLE.has(s.key)).toBe(true);
  });

  it("même graine, même tirage ; une autre graine tire autrement", () => {
    const a = selectHeroSlides(ITEMS, 0.42).map((s) => s.key);
    expect(selectHeroSlides(ITEMS, 0.42).map((s) => s.key)).toEqual(a);
    expect(selectHeroSlides(ITEMS, 0.77).map((s) => s.key)).not.toEqual(a);
  });

  it("moins d'éligibles que d'emplacements : tous, une fois", () => {
    const few = [item("movie:1", true), item("movie:2", false), item("movie:3", false, true)];
    expect(selectHeroSlides(few, 0.1).map((s) => s.key).sort()).toEqual(["movie:1", "movie:3"]);
    expect(selectHeroSlides([], 0.1)).toEqual([]);
  });

  it("ne modifie pas la rangée : « Pour vous » reste entière", () => {
    const before = ITEMS.map((i) => i.key);
    selectHeroSlides(ITEMS, 0.9);
    expect(ITEMS.map((i) => i.key)).toEqual(before);
  });
});

describe("heroSelectionFromRows", () => {
  it("lit « Pour vous » de la page servie — donc filtrée quand elle l'est", () => {
    const selection = heroSelectionFromRows([
      { key: "trending", items: [item("movie:90", true)] },
      { key: "forYou", items: [item("movie:1", true), item("movie:2", false)] },
    ], 0.5);
    expect(selection.slides.map((s) => s.key)).toEqual(["movie:1"]);
    expect(selection.fallbackItem).toBeUndefined();
  });

  it("sans visuel large : l'item de tête en repli ; sans rangée : rien", () => {
    const selection = heroSelectionFromRows([{ key: "forYou", items: [item("movie:1", false)] }], 0.5);
    expect(selection.slides).toEqual([]);
    expect(selection.fallbackItem?.key).toBe("movie:1");
    expect(heroSelectionFromRows(undefined, 0.5).slides).toEqual([]);
    expect(heroSelectionFromRows([], 0.5).fallbackItem).toBeUndefined();
  });
});
