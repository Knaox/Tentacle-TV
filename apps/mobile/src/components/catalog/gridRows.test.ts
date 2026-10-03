import { describe, expect, it } from "vitest";
import { chunkGridRows, gridRowKey } from "./gridRows";

const items = (n: number, prefix = "t") => Array.from({ length: n }, (_, i) => ({ Id: `${prefix}${i}` }));

describe("rangées stables d'une grille", () => {
  it("découpe en rangées de N colonnes, la dernière incomplète", () => {
    const { rows } = chunkGridRows(items(7), 3, new Map());
    expect(rows.map((row) => row.map((it) => it.Id))).toEqual([["t0", "t1", "t2"], ["t3", "t4", "t5"], ["t6"]]);
  });

  it("une page de plus garde les rangées pleines À L'IDENTIQUE (même tableau)", () => {
    const page1 = items(7);
    const first = chunkGridRows(page1, 3, new Map());
    const page2 = [...page1, ...items(5, "u")];
    const second = chunkGridRows(page2, 3, first.cache);
    expect(second.rows[0]).toBe(first.rows[0]);
    expect(second.rows[1]).toBe(first.rows[1]);
    // La rangée incomplète s'est remplie : elle est neuve.
    expect(second.rows[2]).not.toBe(first.rows[2]);
    expect(second.rows[2].map((it) => it.Id)).toEqual(["t6", "u0", "u1"]);
  });

  it("un titre remplacé (nouvel objet) refait sa rangée, et elle seule", () => {
    const list = items(6);
    const first = chunkGridRows(list, 3, new Map());
    const next = [...list];
    next[4] = { Id: "t4" };
    const second = chunkGridRows(next, 3, first.cache);
    expect(second.rows[0]).toBe(first.rows[0]);
    expect(second.rows[1]).not.toBe(first.rows[1]);
  });

  it("un autre nombre de colonnes ne reprend rien", () => {
    const list = items(6);
    const first = chunkGridRows(list, 3, new Map());
    const second = chunkGridRows(list, 2, first.cache);
    expect(second.rows).toHaveLength(3);
    expect(second.rows[0]).not.toBe(first.rows[0]);
  });

  it("la clé d'une rangée est son premier titre", () => {
    expect(gridRowKey([{ Id: "a" }, { Id: "b" }])).toBe("a");
  });
});
