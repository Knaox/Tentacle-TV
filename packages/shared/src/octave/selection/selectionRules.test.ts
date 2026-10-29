import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION, applyGesture, clickGesture, orderedKeys, pruneSelection, selectAll } from "./selectionRules";

const order = ["a", "b", "c", "d", "e"];
const keysOf = (s: { keys: ReadonlySet<string> }) => [...s.keys].sort();

describe("clickGesture", () => {
  const none = { metaKey: false, ctrlKey: false, shiftKey: false };
  it("un clic simple lit, sauf en sélection où il coche", () => {
    expect(clickGesture(none, false)).toBe("play");
    expect(clickGesture(none, true)).toBe("toggle");
  });
  it("Cmd ou Ctrl : un titre ; Maj : une plage", () => {
    expect(clickGesture({ ...none, metaKey: true }, false)).toBe("toggle");
    expect(clickGesture({ ...none, ctrlKey: true }, false)).toBe("toggle");
    expect(clickGesture({ ...none, shiftKey: true, metaKey: true }, false)).toBe("range");
  });
});

describe("applyGesture", () => {
  it("Cmd-clic ajoute puis retire un titre ; vide, la sélection disparaît", () => {
    const one = applyGesture(EMPTY_SELECTION, "L", order, "b", "toggle");
    expect(keysOf(one)).toEqual(["b"]);
    expect(one.anchor).toBe("b");
    expect(applyGesture(one, "L", order, "b", "toggle")).toBe(EMPTY_SELECTION);
  });

  it("Maj-clic étend de l'ancre au titre, dans les deux sens, sans rien perdre", () => {
    let s = applyGesture(EMPTY_SELECTION, "L", order, "a", "toggle");
    s = applyGesture(s, "L", order, "d", "toggle");
    s = applyGesture(s, "L", order, "b", "range");
    expect(keysOf(s)).toEqual(["a", "b", "c", "d"]);
    expect(s.anchor).toBe("d");
  });

  it("Maj-clic sans ancre désigne le seul titre cliqué", () => {
    const s = applyGesture(EMPTY_SELECTION, "L", order, "c", "range");
    expect(keysOf(s)).toEqual(["c"]);
  });

  it("une autre liste repart de zéro", () => {
    const s = applyGesture(applyGesture(EMPTY_SELECTION, "L", order, "a", "toggle"), "M", ["x", "y"], "y", "range");
    expect(s.owner).toBe("M");
    expect(keysOf(s)).toEqual(["y"]);
  });
});

describe("la liste change", () => {
  it("un titre parti quitte la sélection ; l'ancre partie s'oublie", () => {
    const s = selectAll("L", order);
    const pruned = pruneSelection({ ...s, anchor: "a" }, "L", ["b", "c"]);
    expect(keysOf(pruned)).toEqual(["b", "c"]);
    expect(pruned.anchor).toBeNull();
    expect(pruneSelection(s, "L", [])).toBe(EMPTY_SELECTION);
    expect(pruneSelection(s, "M", [])).toBe(s);
  });

  it("les gestes groupés gardent l'ordre affiché", () => {
    expect(orderedKeys(order, new Set(["e", "a", "c"]))).toEqual(["a", "c", "e"]);
  });
});
