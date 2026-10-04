import { describe, expect, it } from "vitest";

import { railDestinationOf, railSelect } from "./railSelect";
import { railStack } from "./railStack";

describe("railSelect — OK sur une entrée du rail", () => {
  it("une entrée se déplace : OK la pose, quelle que soit l'entrée", () => {
    expect(railSelect({ key: "Home", activeKey: "Home", moving: true })).toEqual({ kind: "drop" });
    expect(railSelect({ key: "RailShowAll", activeKey: "Home", moving: true })).toEqual({ kind: "drop" });
  });

  it("« Tout afficher » : le focus va à l'entrée de la page", () => {
    expect(railSelect({ key: "RailShowAll", activeKey: "Library_a", moving: false })).toEqual({ kind: "showAll", focus: "nav:Library_a" });
  });

  it("Rechercher : d'abord la barre, sinon la suite", () => {
    expect(railSelect({ key: "Search", activeKey: "Search", moving: false })).toEqual({ kind: "searchBar", otherwise: { kind: "reselect" } });
    expect(railSelect({ key: "Search", activeKey: "Home", moving: false })).toEqual({
      kind: "searchBar",
      otherwise: { kind: "navigate", to: { route: "Search" }, refocusContentFirst: true },
    });
  });

  it("l'entrée de la page courante : la page la reprend", () => {
    expect(railSelect({ key: "Favorites", activeKey: "Favorites", moving: false })).toEqual({ kind: "reselect" });
  });

  it("une autre page : on y va ; en quittant l'accueil, le focus repasse d'abord au contenu", () => {
    expect(railSelect({ key: "Library_x", activeKey: "Home", moving: false })).toEqual({
      kind: "navigate",
      to: { route: "Library", libraryId: "x" },
      refocusContentFirst: true,
    });
    expect(railSelect({ key: "Home", activeKey: "Library_x", moving: false })).toEqual({
      kind: "navigate",
      to: { route: "Home" },
      refocusContentFirst: false,
    });
  });

  it("une clé sans page : rien ne s'ouvre (l'accueil a quand même rendu son focus)", () => {
    expect(railSelect({ key: "Requests", activeKey: "Home", moving: false })).toEqual({ kind: "navigate", to: null, refocusContentFirst: true });
  });
});

describe("railDestinationOf — la page d'une entrée", () => {
  it("les pages fixes, les bibliothèques, rien d'autre", () => {
    for (const route of ["Home", "Search", "Recommendations", "Watchlist", "Favorites", "Settings"]) {
      expect(railDestinationOf(route)).toEqual({ route });
    }
    expect(railDestinationOf("Library_abc")).toEqual({ route: "Library", libraryId: "abc" });
    expect(railDestinationOf("RailShowAll")).toBeNull();
  });
});

describe("railStack — la pile en onglets", () => {
  const home = { key: "home-1", name: "Home", params: undefined };

  it("une page du rail se pose au-dessus de l'accueil, qui garde sa clé", () => {
    expect(railStack([home, { key: "lib-1", name: "Library" }], { name: "Favorites" })).toEqual({
      index: 1,
      routes: [{ key: "home-1", name: "Home", params: undefined }, { name: "Favorites" }],
    });
  });

  it("l'accueil choisi : lui seul, sa clé gardée", () => {
    expect(railStack([home, { name: "Library" }], { name: "Home" })).toEqual({ index: 0, routes: [{ key: "home-1", name: "Home", params: undefined }] });
  });

  it("sans accueil dans la pile : la page seule ; l'accueil choisi : un accueil neuf", () => {
    expect(railStack([{ name: "PairCode" }], { name: "Settings", params: { tab: "navigation" } })).toEqual({
      index: 0,
      routes: [{ name: "Settings", params: { tab: "navigation" } }],
    });
    expect(railStack(undefined, { name: "Home" })).toEqual({ index: 0, routes: [{ name: "Home" }] });
  });

  it("« Changer de profil » mène à « Qui regarde ? », sauf pendant un déplacement", () => {
    expect(railSelect({ key: "SwitchProfile", activeKey: "Home", moving: false })).toEqual({ kind: "switchProfile" });
    expect(railSelect({ key: "SwitchProfile", activeKey: "Home", moving: true })).toEqual({ kind: "drop" });
  });
});
