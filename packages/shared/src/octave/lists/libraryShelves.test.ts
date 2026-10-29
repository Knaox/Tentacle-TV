import { describe, expect, it } from "vitest";
import { arrangeShelf, canMoveToTop, homeFavoritePlaylists, orderByShelf, shelfOrderAfterMove, shelfOrderToTop } from "./libraryShelves";

interface Item {
  key: string;
  favorite?: boolean;
}

const it_ = (key: string, favorite?: boolean): Item => (favorite === undefined ? { key } : { key, favorite });
const keys = (items: readonly Item[]) => items.map((i) => i.key);
const arrange = (favorites: Item[], listing: Item[], order: string[], orderRest = false) =>
  arrangeShelf({ favorites, listing, order, orderRest, keyOf: (i) => i.key, favoriteOf: (i) => i.favorite });

describe("orderByShelf", () => {
  it("sans ordre : l'ordre de la source", () => {
    expect(keys(orderByShelf([it_("a"), it_("b")], (i) => i.key, []))).toEqual(["a", "b"]);
  });
  it("les inconnus d'abord, entre eux dans l'ordre de la source, puis les connus à leur rang", () => {
    expect(keys(orderByShelf([it_("a"), it_("n1"), it_("b"), it_("n2")], (i) => i.key, ["b", "a"]))).toEqual(["n1", "n2", "b", "a"]);
  });
});

describe("arrangeShelf", () => {
  it("les favoris en tête dans l'ordre personnel, le reste dans l'ordre de la source, sans doublon", () => {
    const r = arrange([it_("c", true), it_("a", true)], [it_("a", true), it_("b", false), it_("c", true), it_("d", false)], ["c", "a"]);
    expect(keys(r.favorites)).toEqual(["c", "a"]);
    expect(keys(r.rest)).toEqual(["b", "d"]);
  });
  it("un favori absent des pages chargées est quand même en tête", () => {
    const r = arrange([it_("z", true)], [it_("a", false)], []);
    expect(keys(r.favorites)).toEqual(["z"]);
    expect(keys(r.rest)).toEqual(["a"]);
  });
  it("un NOUVEAU favori (posé depuis, pas encore servi) arrive en tête", () => {
    const r = arrange([it_("a", true)], [it_("a", true), it_("b", true)], ["a"]);
    expect(keys(r.favorites)).toEqual(["b", "a"]);
  });
  it("un favori retiré (drapeau patché) retourne dans le reste, à sa place de la source", () => {
    const r = arrange([it_("a", true), it_("b", true)], [it_("x", false), it_("a", false), it_("b", true)], ["a", "b"]);
    expect(keys(r.favorites)).toEqual(["b"]);
    expect(keys(r.rest)).toEqual(["x", "a"]);
  });
  it("un élément supprimé (ni servi, ni listé) disparaît, son rang ne gêne pas", () => {
    const r = arrange([it_("b", true)], [it_("b", true)], ["gone", "b"]);
    expect(keys(r.favorites)).toEqual(["b"]);
  });
  it("ordre partiel : les connus à leur rang, les autres en tête", () => {
    const r = arrange([it_("a", true), it_("b", true), it_("c", true)], [], ["c"]);
    expect(keys(r.favorites)).toEqual(["a", "b", "c"]);
  });
  it("serveur d'avant (aucun drapeau) : aucun favori, la liste telle quelle", () => {
    const r = arrange([], [it_("a"), it_("b")], []);
    expect(r.favorites).toEqual([]);
    expect(keys(r.rest)).toEqual(["a", "b"]);
  });
  it("les playlists : le reste aussi suit l'ordre personnel", () => {
    const r = arrange([it_("f", true)], [it_("a", false), it_("b", false), it_("f", true)], ["f", "b", "a"], true);
    expect(keys(r.favorites)).toEqual(["f"]);
    expect(keys(r.rest)).toEqual(["b", "a"]);
  });
  it("l'objet de la liste remplace celui du serveur (plus frais)", () => {
    const listed = { key: "a", favorite: true, fresh: 1 };
    const r = arrangeShelf<{ key: string; favorite: boolean; fresh?: number }>({ favorites: [{ key: "a", favorite: true }], listing: [listed], order: [], orderRest: false, keyOf: (i) => i.key, favoriteOf: (i) => i.favorite });
    expect(r.favorites[0]).toBe(listed);
  });
});

describe("gestes", () => {
  it("glisser : la clé à son nouvel index, les autres gardent leur suite", () => {
    expect(shelfOrderAfterMove([], ["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(shelfOrderAfterMove([], ["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(shelfOrderAfterMove([], ["a", "b"], "a", 99)).toEqual(["b", "a"]);
  });
  it("une clé inconnue de la section : l'ordre inchangé", () => {
    expect(shelfOrderAfterMove(["x"], ["a"], "z", 0)).toEqual(["x"]);
  });
  it("les clés des autres sections montrées (le reste des playlists) gardent leur rang, les clés oubliées partent", () => {
    expect(shelfOrderAfterMove(["f1", "f2", "r2", "gone", "r1"], ["f1", "f2"], "f2", 0, ["r1", "r2"])).toEqual(["f2", "f1", "r2", "r1"]);
  });
  it("Mettre en haut", () => {
    expect(shelfOrderToTop(["a", "b"], ["n", "a", "b"], "b")).toEqual(["b", "n", "a"]);
    expect(canMoveToTop(["a", "b"], "a")).toBe(false);
    expect(canMoveToTop(["a", "b"], "b")).toBe(true);
    expect(canMoveToTop(["a"], "z")).toBe(false);
  });
});

describe("accueil", () => {
  it("les playlists favorites dans l'ordre personnel (nouvelles en tête), huit au plus", () => {
    const favorites = Array.from({ length: 4 }, (_, i) => it_(`p${i}`, true));
    expect(keys(homeFavoritePlaylists(favorites, (i) => i.key, ["p3", "p0"]))).toEqual(["p1", "p2", "p3", "p0"]);
    const many = Array.from({ length: 10 }, (_, i) => it_(`p${i}`, true));
    expect(homeFavoritePlaylists(many, (i) => i.key, [])).toHaveLength(8);
  });
});
