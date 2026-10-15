import { describe, expect, it } from "vitest";
import { tvRecoHero, tvRecoNotice, tvRecoServedCards, tvRecoShelves, type TvRecoPageLike } from "./recoShelves";

type Item = { key: string; jellyfinItemId: string | null };

const lib = (id: string): Item => ({ key: `movie:${id}`, jellyfinItemId: id });
const outside = (id: string): Item => ({ key: `movie:${id}`, jellyfinItemId: null });

function page(rows: TvRecoPageLike<Item>["rows"], over: Partial<TvRecoPageLike<Item>> = {}): TvRecoPageLike<Item> {
  return { state: "ready", generating: false, refining: false, rows, ...over };
}

describe("tvRecoShelves", () => {
  it("ne garde que la bibliothèque", () => {
    const shelves = tvRecoShelves(page([{ key: "forYou", items: [lib("a"), outside("x"), lib("b"), lib("c")] }]));
    expect(shelves[0].items.map((i) => i.jellyfinItemId)).toEqual(["a", "b", "c"]);
  });

  it("un titre ne revient pas d'une rangée à l'autre, héros compris", () => {
    const p = page([
      { key: "forYou", items: [lib("a"), lib("b"), lib("c"), lib("d")] },
      { key: "inLibrary", items: [lib("b"), lib("e"), lib("f"), lib("g")] },
    ]);
    const hero = tvRecoHero(p);
    expect(hero?.jellyfinItemId).toBe("a");
    const shelves = tvRecoShelves(p, { hero });
    expect(shelves.map((s) => s.items.map((i) => i.jellyfinItemId))).toEqual([["b", "c", "d"], ["e", "f", "g"]]);
  });

  it("une rangée vidée par le filtre disparaît, une rangée trop courte aussi", () => {
    const shelves = tvRecoShelves(page([
      { key: "forYou", items: [lib("a"), lib("b"), lib("c")] },
      { key: "discover", items: [outside("x"), outside("y")] },
      { key: "trending", items: [lib("a"), lib("z")] },
    ]));
    expect(shelves.map((s) => s.key)).toEqual(["forYou"]);
  });

  it("s'il ne reste que des rangées courtes, on les garde", () => {
    const shelves = tvRecoShelves(page([{ key: "forYou", items: [lib("a")] }]));
    expect(shelves.map((s) => s.key)).toEqual(["forYou"]);
  });

  it("borne la longueur d'une étagère", () => {
    const items = Array.from({ length: 40 }, (_, i) => lib(`i${i}`));
    expect(tvRecoShelves(page([{ key: "forYou", items }]))[0].items).toHaveLength(24);
  });

  it("garde ouverte (`external`) : les titres hors bibliothèque restent à leur place", () => {
    const shelves = tvRecoShelves(page([{ key: "forYou", items: [lib("a"), outside("x"), lib("b"), outside("y")] }]), { external: true });
    expect(shelves[0].items.map((i) => i.key)).toEqual(["movie:a", "movie:x", "movie:b", "movie:y"]);
  });

  it("garde ouverte : un titre hors bibliothèque ne revient pas non plus d'une rangée à l'autre", () => {
    const shelves = tvRecoShelves(page([
      { key: "forYou", items: [outside("x"), lib("a"), lib("b")] },
      { key: "discover", items: [outside("x"), outside("y"), outside("z"), outside("w")] },
    ]), { external: true });
    expect(shelves.map((s) => s.items.map((i) => i.key))).toEqual([
      ["movie:x", "movie:a", "movie:b"],
      ["movie:y", "movie:z", "movie:w"],
    ]);
  });

  it("garde ouverte : le héros reste un titre de la bibliothèque, et ne revient pas dans les étagères", () => {
    const p = page([{ key: "forYou", items: [outside("x"), lib("a"), lib("b"), outside("y")] }]);
    const hero = tvRecoHero(p);
    expect(hero?.jellyfinItemId).toBe("a");
    expect(tvRecoShelves(p, { hero, external: true })[0].items.map((i) => i.key)).toEqual(["movie:x", "movie:b", "movie:y"]);
  });

  it("garde le titre de la graine", () => {
    const shelves = tvRecoShelves(page([
      { key: "becauseYouLiked:movie:603", seedTitle: "Matrix", items: [lib("a"), lib("b"), lib("c")] },
    ]));
    expect(shelves[0].seedTitle).toBe("Matrix");
  });
});

describe("tvRecoHero", () => {
  it("passe à la bibliothèque quand « Pour vous » n'a rien d'ici", () => {
    const p = page([
      { key: "forYou", items: [outside("x")] },
      { key: "inLibrary", items: [lib("b")] },
    ]);
    expect(tvRecoHero(p)?.jellyfinItemId).toBe("b");
    expect(tvRecoHero(undefined)).toBeNull();
  });
});

describe("tvRecoNotice", () => {
  it("dit la préparation plutôt qu'une page vide", () => {
    expect(tvRecoNotice(page([], { generating: true }), [])).toBe("preparing");
    expect(tvRecoNotice(page([], { state: "disabled" }), [])).toBe("disabled");
    // Pas de clé TMDB : la cause est le serveur, pas le compte — même si les
    // rangées globales (bibliothèque) sont servies.
    expect(tvRecoNotice(page([], { state: "disabled", tmdbConfigured: false }), [])).toBe("tmdbOff");
    expect(tvRecoNotice(page([], { state: "disabled", tmdbConfigured: true }), [])).toBe("disabled");
    const p = page([{ key: "forYou", items: [lib("a"), lib("b"), lib("c")] }], { state: "cold" });
    expect(tvRecoNotice(p, tvRecoShelves(p))).toBe("cold");
    expect(tvRecoNotice(page([{ key: "forYou", items: [lib("a")] }]), [])).toBeNull();
  });
});

describe("tvRecoServedCards", () => {
  it("mêle les cartes de la bibliothèque et celles des titres à demander, dans l'ordre servi", () => {
    const cards = tvRecoServedCards([lib("a"), outside("x"), lib("b")], (id) => `lib:${id}`, (item) => `absent:${item.key}`);
    expect(cards).toEqual(["lib:a", "absent:movie:x", "lib:b"]);
  });

  it("saute un titre sans carte : item pas encore lu, état pas encore su", () => {
    const cards = tvRecoServedCards([lib("a"), outside("x"), lib("b")], (id) => (id === "a" ? "lib:a" : undefined), () => undefined);
    expect(cards).toEqual(["lib:a"]);
  });
});
