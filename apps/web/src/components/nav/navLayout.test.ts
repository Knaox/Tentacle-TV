/**
 * La disposition de la barre : ordre choisi, destinations nouvelles, retraits.
 */

import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT, appendPinned, applyOrder, nudge, parseLayout, reorderPinned, withHidden } from "./navLayout";

const entries = ["home", "recommendations", "lib-films", "lib-series", "favorites"].map((key) => ({ key }));
const keys = (list: Array<{ key: string }>) => list.map((e) => e.key);

describe("applyOrder", () => {
  it("sans ordre choisi : l'ordre par défaut", () => {
    expect(keys(applyOrder(entries, []))).toEqual(["home", "recommendations", "lib-films", "lib-series", "favorites"]);
  });

  it("l'ordre choisi, puis les destinations qu'il ne connaît pas", () => {
    const order = ["lib-series", "home", "gone", "lib-films"];
    // « gone » n'existe plus : ignoré. « recommendations » et « favorites » : à la suite.
    expect(keys(applyOrder(entries, order))).toEqual(["lib-series", "home", "lib-films", "recommendations", "favorites"]);
  });
});

describe("réordonner", () => {
  const all = ["home", "recommendations", "lib-films", "lib-series", "favorites"];

  it("les épinglées dans l'ordre voulu, les autres ensuite", () => {
    expect(reorderPinned(all, ["lib-films", "home"])).toEqual(["lib-films", "home", "recommendations", "lib-series", "favorites"]);
  });

  it("monter, descendre, et rien aux bords", () => {
    expect(nudge(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(nudge(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(nudge(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(nudge(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("épingler range la destination au bout de la barre", () => {
    expect(appendPinned(all, ["home", "lib-films"], "favorites")).toEqual(["home", "lib-films", "favorites", "recommendations", "lib-series"]);
  });
});

describe("retraits et lecture", () => {
  it("retirer puis rendre", () => {
    expect(withHidden([], "lib-films", true)).toEqual(["lib-films"]);
    expect(withHidden(["lib-films", "home"], "lib-films", false)).toEqual(["home"]);
    // Pas de doublon.
    expect(withHidden(["lib-films"], "lib-films", true)).toEqual(["lib-films"]);
  });

  it("un stockage abîmé vaut « rien de choisi »", () => {
    expect(parseLayout(null)).toBe(EMPTY_LAYOUT);
    expect(parseLayout("{pas du json")).toBe(EMPTY_LAYOUT);
    expect(parseLayout(JSON.stringify({ order: ["a", 3], hidden: "x" }))).toEqual({ order: ["a"], hidden: [] });
  });
});
