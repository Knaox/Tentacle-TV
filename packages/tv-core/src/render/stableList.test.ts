import { describe, expect, it } from "vitest";
import { stabilizeList, type StableList } from "./stableList";

interface Card {
  id: string;
  title: string;
}

const key = (card: Card) => card.id;
const same = (a: Card, b: Card) => a.id === b.id && a.title === b.title;
const cards = (...ids: string[]): Card[] => ids.map((id) => ({ id, title: `t${id}` }));

describe("une liste stable d'une réponse à l'autre", () => {
  it("rend la liste neuve telle quelle la première fois", () => {
    const next = cards("a", "b");
    const list = stabilizeList(null, next, key, same);
    expect(list.items).toEqual(next);
    expect(list.items[0]).toBe(next[0]);
  });

  it("garde l'objet d'un élément inchangé, prend le neuf d'un élément changé", () => {
    const first = stabilizeList(null, cards("a", "b"), key, same);
    const next = [{ id: "a", title: "ta" }, { id: "b", title: "autre" }, { id: "c", title: "tc" }];
    const list = stabilizeList(first, next, key, same);
    expect(list.items[0]).toBe(first.items[0]);
    expect(list.items[1]).toBe(next[1]);
    expect(list.items[2]).toBe(next[2]);
    expect(list.items).not.toBe(first.items);
  });

  it("garde le TABLEAU précédent quand rien n'a changé, ni l'ordre", () => {
    const first = stabilizeList(null, cards("a", "b"), key, same);
    expect(stabilizeList(first, cards("a", "b"), key, same).items).toBe(first.items);
  });

  it("rend un tableau neuf quand l'ordre change, avec les mêmes objets", () => {
    const first = stabilizeList(null, cards("a", "b"), key, same);
    const list = stabilizeList(first, cards("b", "a"), key, same);
    expect(list.items).not.toBe(first.items);
    expect(list.items[0]).toBe(first.items[1]);
    expect(list.items[1]).toBe(first.items[0]);
  });

  it("oublie ce qui a quitté la liste", () => {
    const first = stabilizeList(null, cards("a", "b"), key, same);
    const second = stabilizeList(first, cards("b"), key, same);
    const third: StableList<Card> = stabilizeList(second, cards("a", "b"), key, same);
    expect(third.items[0]).not.toBe(first.items[0]);
    expect(third.items[1]).toBe(first.items[1]);
  });
});
