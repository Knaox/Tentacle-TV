import { describe, expect, it } from "vitest";
import { initialOf, letterRangeOf, ratingStepOf } from "./groupModel";
import { groupItems, type GroupableItem } from "./listGroups";

function item(id: string, over: Partial<GroupableItem> = {}): GroupableItem {
  return { id, title: id, kind: "movie", animated: false, genres: [], year: 2015, rating: 7.2, ...over };
}

describe("les rangées d'une liste", () => {
  it("par type : Films, Séries, Animés — une série d'animation est un animé, un film d'animation reste un film", () => {
    const groups = groupItems(
      [
        item("anime", { kind: "series", animated: true }),
        item("film"),
        item("serie", { kind: "series" }),
        item("pixar", { animated: true }),
      ],
      "type",
    );
    expect(groups.map((g) => g.key)).toEqual(["type:movies", "type:series", "type:anime"]);
    expect(groups[0].ids).toEqual(["film", "pixar"]);
  });

  it("par genre : le premier genre, les plus gros d'abord, les petits réunis en dernier — rien en double", () => {
    const items = [
      ...["d1", "d2", "d3", "d4"].map((id) => item(id, { genres: ["Drame", "Thriller"] })),
      ...["a1", "a2", "a3"].map((id) => item(id, { genres: ["Action"] })),
      item("w1", { genres: ["Western"] }),
      item("h1", { genres: ["Horreur"] }),
      item("nu"),
    ];
    const groups = groupItems(items, "genre");
    expect(groups.map((g) => g.key)).toEqual(["genre:Drame", "genre:Action", "genre:other"]);
    // Les petits genres gardent l'ordre de la liste (le tri choisi).
    expect(groups[2].ids).toEqual(["w1", "h1", "nu"]);
    expect(groups.flatMap((g) => g.ids)).toHaveLength(items.length);
  });

  it("un seul petit genre garde son nom", () => {
    const groups = groupItems([...["a1", "a2", "a3"].map((id) => item(id, { genres: ["Action"] })), item("w1", { genres: ["Western"] })], "genre");
    expect(groups.map((g) => g.label)).toEqual([{ kind: "genre", name: "Action" }, { kind: "genre", name: "Western" }]);
  });

  it("par lettres : tranches fixes, accents retirés, « 0 – 9 » en dernier", () => {
    expect(initialOf("Élémentaire")).toBe("E");
    expect(letterRangeOf("Élémentaire")).toBe(1);
    expect(letterRangeOf("Zodiac")).toBe(7);
    expect(letterRangeOf("2001 : l'odyssée")).toBe(8);
    const groups = groupItems([item("Zodiac"), item("Alien"), item("300"), item("Brazil")], "alpha");
    expect(groups.map((g) => g.label)).toEqual([
      { kind: "letters", from: "A", to: "C" },
      { kind: "letters", from: "V", to: "Z" },
      { kind: "digits" },
    ]);
    expect(groups[0].ids).toEqual(["Alien", "Brazil"]);
  });

  it("par décennie : la plus récente d'abord, puis « Avant 1970 » avec les titres sans année", () => {
    const groups = groupItems([item("a", { year: 1999 }), item("b", { year: 2021 }), item("c", { year: 1962 }), item("d", { year: null })], "year");
    expect(groups.map((g) => g.key)).toEqual(["year:2020", "year:1990", "year:before"]);
    expect(groups[2].ids).toEqual(["c", "d"]);
  });

  it("par note : du meilleur palier au plus bas, « Sans note » en dernier", () => {
    expect([8.4, 7, 6.9, 5.1, null, 0].map(ratingStepOf)).toEqual([0, 1, 2, 3, -1, -1]);
    const groups = groupItems([item("bas", { rating: 4 }), item("top", { rating: 8.1 }), item("sans", { rating: null })], "rating");
    expect(groups.map((g) => g.label)).toEqual([
      { kind: "ratingAtLeast", min: 8 },
      { kind: "ratingBelow", max: 6 },
      { kind: "noRating" },
    ]);
  });
});
