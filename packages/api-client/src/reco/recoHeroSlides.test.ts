import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "../hooks/recoTypes";
import { heroSelectionFromRows, selectHeroSlides } from "./recoHeroSlides";

const item = (key: string, backdrop: boolean, jellyfin = false): RecoRowItem => ({
  key,
  mediaType: key.startsWith("tv:") ? "tv" : "movie",
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

  it("un titre qui quitte la rangée n'emporte que SA diapositive : les autres restent, dans le même ordre", () => {
    const before = selectHeroSlides(ITEMS, 0.42).map((s) => s.key);
    const gone = before[1];
    const after = selectHeroSlides(ITEMS.filter((i) => i.key !== gone), 0.42).map((s) => s.key);
    expect(after.slice(0, 4)).toEqual(before.filter((key) => key !== gone));
    // Un titre hors du tirage peut partir : le carrousel ne bouge pas.
    const outside = ITEMS.find((i) => ELIGIBLE.has(i.key) && !before.includes(i.key))!.key;
    expect(selectHeroSlides(ITEMS.filter((i) => i.key !== outside), 0.42).map((s) => s.key)).toEqual(before);
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

describe("heroSelectionFromRows — un genre (Pour vous — Films / Séries)", () => {
  const page = [
    { key: "forYou", items: [item("tv:1", true), item("movie:2", true), item("movie:3", false), item("tv:4", true), item("movie:5", true)] },
  ];

  it("les mieux recommandés du genre, dans l'ordre servi, quelle que soit la graine", () => {
    expect(heroSelectionFromRows(page, 0.1, "movie").slides.map((s) => s.key)).toEqual(["movie:2", "movie:5"]);
    expect(heroSelectionFromRows(page, 0.9, "movie").slides.map((s) => s.key)).toEqual(["movie:2", "movie:5"]);
    expect(heroSelectionFromRows(page, 0.5, "tv").slides.map((s) => s.key)).toEqual(["tv:1", "tv:4"]);
  });

  it("rien du genre : aucune diapositive ni repli — l'accueil garde sa bannière de reprise", () => {
    const selection = heroSelectionFromRows([{ key: "forYou", items: [item("movie:1", true)] }], 0.5, "tv");
    expect(selection).toEqual({ slides: [], fallbackItem: undefined });
  });
});
