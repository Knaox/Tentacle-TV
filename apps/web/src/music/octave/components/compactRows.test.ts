import { describe, expect, it } from "vitest";
import { chainHandlers, compactRowColumns } from "./compactRows";

describe("compactRowColumns", () => {
  it("le titre prend toute la place qui reste, quelles que soient les colonnes", () => {
    for (const handle of [false, true]) {
      for (const select of [false, true]) {
        for (const number of [false, true]) {
          const cols = compactRowColumns({ handle, select, number });
          expect(cols).toMatch(/^grid-cols-\[.*minmax\(0,1fr\)_auto\]$/);
          // Une colonne par élément montré, plus le titre et les gestes.
          expect(cols.split("_").length).toBe(2 + +handle + +select + +number);
        }
      }
    }
  });

  it("une rangée de playlist au téléphone : poignée, puis le titre", () => {
    expect(compactRowColumns({ handle: true, select: false, number: false })).toBe("grid-cols-[1.25rem_minmax(0,1fr)_auto]");
  });
});

describe("chainHandlers", () => {
  it("un évènement présent des deux côtés appelle les deux, dans l'ordre ; les autres passent tels quels", () => {
    const calls: string[] = [];
    const merged = chainHandlers(
      { onPointerDown: () => calls.push("prefetch"), onFocus: () => calls.push("focus") },
      { onPointerDown: () => calls.push("longPress"), onPointerUp: () => calls.push("up") },
    );
    merged.onPointerDown();
    merged.onFocus();
    merged.onPointerUp();
    expect(calls).toEqual(["prefetch", "longPress", "focus", "up"]);
  });
});
