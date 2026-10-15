import { describe, expect, it } from "vitest";
import {
  EMPTY_DELETION_SELECTION,
  confirmationPreview,
  deletionBatches,
  pruneSelection,
  rangeInSelection,
  selectAllInSelection,
  summarizeDeletion,
  toggleInSelection,
} from "./deletionSelection";

const ORDER = ["a", "b", "c", "d", "e", "f"];
/** « c » n'est pas supprimable pour ce compte (Jellyfin : CanDelete = false). */
const deletable = (id: string) => ORDER.includes(id) && id !== "c";
const ids = (state: { selected: ReadonlySet<string> }) => [...state.selected].sort();

describe("toggleInSelection", () => {
  it("coche, décoche, et ne coche jamais un titre que Jellyfin refuse", () => {
    let state = toggleInSelection(EMPTY_DELETION_SELECTION, "a", deletable);
    expect([ids(state), state.anchor]).toEqual([["a"], "a"]);
    state = toggleInSelection(state, "c", deletable);
    expect(ids(state)).toEqual(["a"]);
    state = toggleInSelection(state, "a", deletable);
    expect(ids(state)).toEqual([]);
  });
});

describe("rangeInSelection (Maj + clic)", () => {
  it("coche la plage de l'origine au titre visé, en sautant ce qui n'est pas supprimable", () => {
    const start = toggleInSelection(EMPTY_DELETION_SELECTION, "b", deletable);
    const state = rangeInSelection(start, "e", ORDER, deletable);
    expect(ids(state)).toEqual(["b", "d", "e"]);
    expect(state.anchor).toBe("b");
  });

  it("vers le haut aussi, et décoche la plage quand le titre visé était coché", () => {
    let state = selectAllInSelection(ORDER, deletable);
    state = toggleInSelection(state, "f", deletable); // décoche f, origine f
    state = rangeInSelection({ ...state, selected: new Set([...state.selected, "f"]) }, "b", ORDER, deletable);
    expect(ids(state)).toEqual(["a"]);
  });

  it("sans origine dans l'ordre : un simple basculement", () => {
    expect(ids(rangeInSelection(EMPTY_DELETION_SELECTION, "d", ORDER, deletable))).toEqual(["d"]);
  });
});

describe("selectAllInSelection", () => {
  it("prend toute la liste donnée — pas seulement la page chargée — sauf les titres refusés", () => {
    const library = Array.from({ length: 120 }, (_, i) => `t${i}`);
    const loaded = new Set(library.slice(0, 50));
    const state = selectAllInSelection(library, (id) => id !== "t99");
    expect(state.selected.size).toBe(119);
    expect([...state.selected].filter((id) => !loaded.has(id))).toHaveLength(69);
  });
});

describe("pruneSelection", () => {
  it("retire les titres partis ou devenus non supprimables, et rend le même état si rien ne change", () => {
    const state = selectAllInSelection(["a", "b", "d"], deletable);
    expect(ids(pruneSelection(state, new Set(["a", "d"]), deletable))).toEqual(["a", "d"]);
    expect(pruneSelection(state, new Set(ORDER), deletable)).toBe(state);
  });
});

describe("confirmationPreview", () => {
  it("montre les premiers noms puis « et N autres », jamais « et 1 autre »", () => {
    expect(confirmationPreview(["1", "2", "3"])).toEqual({ names: ["1", "2", "3"], more: 0 });
    expect(confirmationPreview(["1", "2", "3", "4", "5", "6"])).toEqual({ names: ["1", "2", "3", "4", "5", "6"], more: 0 });
    expect(confirmationPreview(Array.from({ length: 12 }, (_, i) => `${i}`))).toEqual({ names: ["0", "1", "2", "3", "4"], more: 7 });
  });
});

describe("deletionBatches et summarizeDeletion", () => {
  it("découpe en lots du contrat et fait le bilan, un titre sans réponse compté en échec", () => {
    const all = Array.from({ length: 45 }, (_, i) => `t${i}`);
    expect(deletionBatches(all).map((b) => b.length)).toEqual([20, 20, 5]);
    const summary = summarizeDeletion(["a", "b", "c", "d", "e"], [
      { id: "a", outcome: "deleted" },
      { id: "b", outcome: "forbidden" },
      { id: "c", outcome: "gone" },
      { id: "d", outcome: "failed" },
    ]);
    expect(summary).toEqual({ removed: ["a", "c"], gone: ["c"], forbidden: ["b"], failed: ["d", "e"] });
  });
});
