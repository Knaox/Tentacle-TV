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

describe("selectHeroSlides", () => {
  it("prend les premiers items à visuel large, cinq au plus, dans la fenêtre", () => {
    const items = [
      item("movie:1", false),
      item("movie:2", true),
      item("movie:3", false, true),
      item("movie:4", true),
      item("movie:5", true),
      item("movie:6", true),
      item("movie:7", true),
      item("movie:8", true),
      item("movie:9", true),
    ];
    expect(selectHeroSlides(items).map((s) => s.key)).toEqual(["movie:2", "movie:3", "movie:4", "movie:5", "movie:6"]);
  });
});

describe("heroSelectionFromRows", () => {
  it("lit « Pour vous » de la page servie — donc filtrée quand elle l'est", () => {
    const selection = heroSelectionFromRows([
      { key: "trending", items: [item("movie:90", true)] },
      { key: "forYou", items: [item("movie:1", true), item("movie:2", false)] },
    ]);
    expect(selection.slides.map((s) => s.key)).toEqual(["movie:1"]);
    expect(selection.excludeKeys).toEqual(["movie:1"]);
    expect(selection.fallbackItem).toBeUndefined();
  });

  it("sans visuel large : l'item de tête en repli ; sans rangée : rien", () => {
    const selection = heroSelectionFromRows([{ key: "forYou", items: [item("movie:1", false)] }]);
    expect(selection.slides).toEqual([]);
    expect(selection.fallbackItem?.key).toBe("movie:1");
    expect(heroSelectionFromRows(undefined).slides).toEqual([]);
    expect(heroSelectionFromRows([]).excludeKeys).toEqual([]);
  });
});
