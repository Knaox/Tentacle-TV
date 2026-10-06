import { describe, expect, it } from "vitest";
import { heldRowView } from "./heldRow";

/**
 * Une rangée survolée garde ses cartes jusqu'au lâcher — « vu » dans
 * Reprendre, le cœur décoché dans Mes favoris, Ma liste retirée : rien ne
 * glisse sous le curseur.
 */

interface Card { Id: string; progress: number }
const card = (Id: string, progress = 0): Card => ({ Id, progress });
const id = (c: Card) => c.Id;
const ids = (list: readonly Card[]) => list.map(id);

describe("une rangée tenue", () => {
  const frozen = [card("a"), card("b"), card("c")];

  it("garde une carte que la liste vient de perdre (« vu » dans Reprendre)", () => {
    expect(ids(heldRowView([card("a"), card("c")], frozen, true, id))).toEqual(["a", "b", "c"]);
  });

  it("au lâcher, suit ses données : la carte part", () => {
    const items = [card("a"), card("c")];
    expect(heldRowView(items, null, false, id)).toBe(items);
  });

  it("rend la dernière version d'une carte encore là (sa progression)", () => {
    const view = heldRowView([card("b", 0.7), card("a")], frozen, true, id);
    expect(view.find((c) => c.Id === "b")?.progress).toBe(0.7);
  });

  it("n'insère ni ne réordonne rien pendant le survol : l'arrivée attend le lâcher", () => {
    expect(ids(heldRowView([card("z"), card("c"), card("a"), card("b")], frozen, true, id))).toEqual(["a", "b", "c"]);
  });

  it("laisse partir tout de suite ce que `drop` désigne", () => {
    expect(ids(heldRowView(frozen, frozen, true, id, (c) => c.Id === "b"))).toEqual(["a", "c"]);
  });

  it("tenue avant toute photographie : la liste telle quelle", () => {
    expect(ids(heldRowView([card("a")], null, true, id))).toEqual(["a"]);
  });
});
