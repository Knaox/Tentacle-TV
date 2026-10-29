/** Les gestes d'une sélection : lesquels, dans quel ordre — la même liste pour le bureau et le mobile. */

import { describe, expect, it } from "vitest";
import { selectionActions, type SelectionActionContext } from "./selectionActions";
import { EMPTY_SELECTION, applyGesture, isSelecting, openSelection, pruneSelection, selectAll } from "./selectionRules";

const base: SelectionActionContext = { count: 3, canAddToPlaylist: true, canQueue: true, like: { liked: true }, canRemove: false };

describe("selectionActions", () => {
  it("playlist, puis la file, puis le cœur ; rien sans titre choisi", () => {
    expect(selectionActions(base)).toEqual(["addToPlaylist", "playNext", "enqueue", "like"]);
    expect(selectionActions({ ...base, count: 0 })).toEqual([]);
  });

  it("une playlist à soi : « Retirer » en dernier ; dans la file, ni « Lire ensuite » ni « Ajouter à la file »", () => {
    expect(selectionActions({ ...base, canRemove: true }).at(-1)).toBe("remove");
    expect(selectionActions({ ...base, inQueue: true, canRemove: true })).toEqual(["addToPlaylist", "like", "remove"]);
  });

  it("tous déjà aimés : « Ne plus aimer » ; rien à aimer ni à ajouter : ces gestes disparaissent", () => {
    expect(selectionActions({ ...base, like: { liked: false } })).toContain("unlike");
    expect(selectionActions({ ...base, like: null, canAddToPlaylist: false, canQueue: false })).toEqual([]);
  });
});

describe("« Sélectionner » ouvre la sélection vide", () => {
  const order = ["a", "b", "c"];
  it("ouverte sans titre, elle le reste quand on décoche le dernier", () => {
    let s = openSelection("L");
    expect(isSelecting(s, "L")).toBe(true);
    s = applyGesture(s, "L", order, "b", "toggle");
    expect([...s.keys]).toEqual(["b"]);
    s = applyGesture(s, "L", order, "b", "toggle");
    expect(isSelecting(s, "L")).toBe(true);
    expect(s.keys.size).toBe(0);
  });

  it("sans « Sélectionner », décocher le dernier ferme (comportement du bureau inchangé)", () => {
    const s = applyGesture(applyGesture(EMPTY_SELECTION, "L", order, "a", "toggle"), "L", order, "a", "toggle");
    expect(isSelecting(s, "L")).toBe(false);
  });

  it("tout choisir garde l'ouverture ; un titre disparu de la liste n'emporte pas le mode", () => {
    expect(selectAll("L", order, true).open).toBe(true);
    const s = pruneSelection(applyGesture(openSelection("L"), "L", order, "a", "toggle"), "L", ["b", "c"]);
    expect(isSelecting(s, "L")).toBe(true);
  });
});
