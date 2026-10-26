import { describe, expect, it } from "vitest";
import { planAddedDates } from "./addedPlan";

const NOW = 1_800_000_000_000;

describe("dates d'entrée dans une liste", () => {
  it("première lecture d'une playlist : l'ordre de la playlist est celui des ajouts, tout avant maintenant", () => {
    const plan = planAddedDates(new Map(), ["a", "b", "c"], NOW, () => null);
    const [a, b, c] = ["a", "b", "c"].map((id) => plan.dates.get(id)!);
    expect(a).toBeLessThan(b!);
    expect(b).toBeLessThan(c!);
    expect(c).toBeLessThan(NOW);
    expect(plan.insert).toHaveLength(3);
    expect(plan.remove).toEqual([]);
  });

  it("première lecture des likés : estimée par l'ajout à la bibliothèque, jamais dans le futur", () => {
    const plan = planAddedDates(new Map(), ["a", "b"], NOW, (id) => (id === "a" ? NOW - 10_000 : NOW + 99_999));
    expect(plan.dates.get("a")).toBe(NOW - 10_000);
    expect(plan.dates.get("b")).toBeLessThan(NOW);
  });

  it("ensuite : un nouveau titre est daté maintenant, les connus gardent leur date, les partis sont oubliés", () => {
    const known = new Map([["a", 1], ["b", 2], ["gone", 3]]);
    const plan = planAddedDates(known, ["a", "b", "n1", "n2"], NOW, () => 0);
    expect(plan.dates.get("a")).toBe(1);
    expect(plan.dates.get("n1")).toBe(NOW);
    expect(plan.dates.get("n2")).toBe(NOW + 1);
    expect(plan.insert.map((i) => i.itemId)).toEqual(["n1", "n2"]);
    expect(plan.remove).toEqual(["gone"]);
  });

  it("une liste lue vide (Jellyfin muet) n'efface rien", () => {
    expect(planAddedDates(new Map([["a", 1]]), [], NOW, () => null).remove).toEqual([]);
  });
});
