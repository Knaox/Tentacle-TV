import { describe, expect, it } from "vitest";

import {
  arrangeOnFocus, railArrangeReading, rowsArrangeReading, rowsSelectWhileArranging, startArrange, type ArrangeMove,
} from "./arrange";
import { RAIL_LOCKED_WHILE_MOVING, isMovableRailKey, isNavKey, isNavMenuKey, libraryIdOf, libraryRailKey, navEntryOf, navKeyOf } from "./railKeys";

const ORDER = ["Recommendations", "Watchlist", "Favorites", "Library_a", "Library_b", "Library_c"];

describe("startArrange — soulever une entrée", () => {
  it("garde l'ordre complet de départ, copié, et la case", () => {
    const order = [...ORDER];
    const move = startArrange("Library_a", order, 4);
    order.reverse();
    expect(move).toEqual({ key: "Library_a", order: ORDER, from: 4 });
  });
});

describe("arrangeOnFocus — le focus passe à la case voisine", () => {
  const move: ArrangeMove = startArrange("Library_a", ORDER, 4);

  it("une autre entrée : l'entrée soulevée passe de l'autre côté (descend : juste après)", () => {
    expect(arrangeOnFocus(move, { kind: "entry", key: "Library_b" })).toEqual({
      kind: "reorder",
      move: { key: "Library_a", order: ["Recommendations", "Watchlist", "Favorites", "Library_b", "Library_a", "Library_c"], from: 4 },
    });
  });

  it("monte : juste avant", () => {
    expect(arrangeOnFocus(move, { kind: "entry", key: "Watchlist" })).toMatchObject({
      move: { order: ["Recommendations", "Library_a", "Watchlist", "Favorites", "Library_b", "Library_c"] },
    });
  });

  it("l'entrée soulevée elle-même, ou une cible verrouillée : rien", () => {
    expect(arrangeOnFocus(move, { kind: "entry", key: "Library_a" })).toEqual({ kind: "none" });
    expect(arrangeOnFocus(move, { kind: "inside" })).toEqual({ kind: "none" });
  });

  it("hors de la liste : l'entrée est posée", () => {
    expect(arrangeOnFocus(move, { kind: "outside" })).toEqual({ kind: "drop" });
  });

  it("ne touche pas au déplacement d'origine", () => {
    arrangeOnFocus(move, { kind: "entry", key: "Library_c" });
    expect(move.order).toEqual(ORDER);
  });
});

describe("railArrangeReading — le rail", () => {
  it("une entrée organisable", () => {
    expect(railArrangeReading("nav:Library_b")).toEqual({ kind: "entry", key: "Library_b" });
    expect(railArrangeReading("nav:Favorites")).toEqual({ kind: "entry", key: "Favorites" });
  });

  it("Rechercher, Accueil, Tout afficher, le profil, les demandes : dans le rail, rien ne bouge", () => {
    for (const key of ["nav:Search", "nav:Home", "nav:RailShowAll", "nav:Settings", "nav:Requests"]) {
      expect(railArrangeReading(key)).toEqual({ kind: "inside" });
    }
  });

  it("le contenu : hors du rail", () => {
    expect(railArrangeReading("hero:primary")).toEqual({ kind: "outside" });
  });
});

describe("rowsArrangeReading — des lignes (Réglages › Navigation)", () => {
  const keys = ["Watchlist", "Recommendations", "Favorites"];

  it("la ligne d'une case montre l'entrée de l'ordre EN COURS", () => {
    expect(rowsArrangeReading("settings:nav:1", "settings:nav:", keys)).toEqual({ kind: "entry", key: "Recommendations" });
  });

  it("une pastille ou un bouton du préfixe, ou une case vide : rien", () => {
    expect(rowsArrangeReading("settings:nav:1:visibility", "settings:nav:", keys)).toEqual({ kind: "inside" });
    expect(rowsArrangeReading("settings:nav:showAll", "settings:nav:", keys)).toEqual({ kind: "inside" });
    expect(rowsArrangeReading("settings:nav:9", "settings:nav:", keys)).toEqual({ kind: "inside" });
  });

  it("hors des lignes (les onglets) : posée", () => {
    expect(rowsArrangeReading("settings:tab:navigation", "settings:nav:", keys)).toEqual({ kind: "outside" });
  });

  it("OK ne pose que sur la ligne soulevée", () => {
    const move = startArrange("Watchlist", keys, 0);
    expect(rowsSelectWhileArranging(move, "Watchlist")).toBe("drop");
    expect(rowsSelectWhileArranging(move, "Favorites")).toBe("none");
  });
});

describe("railKeys — les clés du rail", () => {
  it("clé de focus d'une entrée, et l'inverse", () => {
    expect(navKeyOf("Home")).toBe("nav:Home");
    expect(navEntryOf("nav:Library_x")).toBe("Library_x");
    expect(navEntryOf("grid:0")).toBeNull();
    expect(isNavKey("nav:menu:up")).toBe(true);
    expect(isNavMenuKey("nav:menu:up")).toBe(true);
    expect(isNavMenuKey("nav:Home")).toBe(false);
    expect(isNavKey(null)).toBe(false);
  });

  it("bibliothèques", () => {
    expect(libraryRailKey("abc")).toBe("Library_abc");
    expect(libraryIdOf("Library_abc")).toBe("abc");
    expect(libraryIdOf("Home")).toBeNull();
  });

  it("organisables : Pour vous, Ma liste, Favoris, les bibliothèques — jamais Rechercher, Accueil, Tout afficher, le profil", () => {
    for (const key of ["Recommendations", "Watchlist", "Favorites", "Library_x"]) expect(isMovableRailKey(key)).toBe(true);
    for (const key of ["Search", "Home", "RailShowAll", "Settings", "Requests"]) expect(isMovableRailKey(key)).toBe(false);
  });

  it("verrouillés pendant un déplacement", () => {
    expect([...RAIL_LOCKED_WHILE_MOVING]).toEqual(["Search", "Home", "RailShowAll", "SwitchProfile", "Settings"]);
  });
});
