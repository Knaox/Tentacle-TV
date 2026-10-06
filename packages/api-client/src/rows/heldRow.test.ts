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

/**
 * Une rangée tenue ne fige que la PLACE de ses cartes, jamais leur état :
 * favori, vu, Ma liste suivent la dernière version de la liste — la mise à
 * jour optimiste d'un geste fait pendant le survol se voit tout de suite.
 */
describe("l'état d'une carte d'une rangée tenue", () => {
  interface Media { Id: string; UserData: { IsFavorite: boolean; Played: boolean; Likes: boolean } }
  const media = (Id: string, flags: Partial<Media["UserData"]> = {}): Media => ({
    Id,
    UserData: { IsFavorite: false, Played: false, Likes: false, ...flags },
  });
  const key = (m: Media) => m.Id;
  const frozen = [media("a"), media("b")];

  it.each(["IsFavorite", "Played", "Likes"] as const)("%s suit la liste patchée", (flag) => {
    const patched = [media("a"), media("b", { [flag]: true })];
    const view = heldRowView(patched, frozen, true, key);
    expect(view.map(key)).toEqual(["a", "b"]);
    expect(view[1].UserData[flag]).toBe(true);
  });
});
