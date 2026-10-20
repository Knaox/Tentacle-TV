import { describe, expect, it } from "vitest";
import { focusFirst } from "./focusEntry";

const rows = [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }];

describe("le titre montré par le suivi en direct", () => {
  it("passe en tête des transferts en cours, les autres gardent leur ordre", () => {
    expect(focusFirst(rows, "c").map((row) => row.itemId)).toEqual(["c", "a", "b"]);
  });

  it("absent ou inconnu : rien ne bouge", () => {
    expect(focusFirst(rows, null).map((row) => row.itemId)).toEqual(["a", "b", "c"]);
    expect(focusFirst(rows, "z").map((row) => row.itemId)).toEqual(["a", "b", "c"]);
  });
});
