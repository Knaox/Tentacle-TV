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

  describe("une playlist : un titre posé à la place d'une attente n'est pas un ajout", () => {
    // La playlist importée de Damien (27/10) : a, b, c relus au départ, puis Lidarr livre x entre a et b.
    const known = new Map([["a", 10], ["b", 11], ["c", 12]]);

    it("arrivée au milieu : la date de l'entrée qui la précède (avant : maintenant, en tête de « Derniers ajouts »)", () => {
      const plan = planAddedDates(known, ["a", "x", "b", "c"], NOW, () => null, { ordered: true });
      expect(plan.dates.get("x")).toBe(10);
      expect(plan.insert).toEqual([{ itemId: "x", addedAt: 10 }]);
    });

    it("arrivée en tête : la date de l'entrée qui la suit", () => {
      expect(planAddedDates(known, ["x", "a", "b", "c"], NOW, () => null, { ordered: true }).dates.get("x")).toBe(10);
    });

    it("deux arrivées consécutives au milieu : la même date, l'ordre de la playlist départage", () => {
      const plan = planAddedDates(known, ["a", "b", "x", "y", "c"], NOW, () => null, { ordered: true });
      expect([plan.dates.get("x"), plan.dates.get("y")]).toEqual([11, 11]);
    });

    it("un vrai ajout (en fin de playlist) reste daté maintenant, même après une arrivée posée au milieu", () => {
      const plan = planAddedDates(known, ["a", "x", "b", "c", "n"], NOW, () => null, { ordered: true });
      expect(plan.dates.get("x")).toBe(10);
      expect(plan.dates.get("n")).toBe(NOW);
    });

    it("un titre remplacé à sa place (même rang, autre élément) garde la date de la place", () => {
      const plan = planAddedDates(known, ["a", "b2", "c"], NOW, () => null, { ordered: true });
      expect(plan.dates.get("b2")).toBe(10);
      expect(plan.remove).toEqual(["b"]);
    });

    it("les likés n'ont pas d'ordre d'ajout : un nouveau like est daté maintenant où qu'il soit", () => {
      expect(planAddedDates(known, ["a", "x", "b", "c"], NOW, () => null).dates.get("x")).toBe(NOW);
    });
  });

  describe("une playlist IMPORTÉE : la date d'un titre de la source suit son rang (relevé du 27/10)", () => {
    // Jellyfin dans le désordre (l'ordre faux d'avant la 1.40.0) : c (rang 2), a (rang 0), b (rang 1).
    const pinned = new Map([["a", 100], ["b", 101], ["c", 102]]);

    it("le rang fait foi, jamais l'ordre de Jellyfin ; il REMPLACE une date estimée d'après l'ordre faux", () => {
      const known = new Map([["c", 1], ["a", 2], ["b", 3]]);
      const plan = planAddedDates(known, ["c", "a", "b"], NOW, () => null, { ordered: true, pinned });
      expect([...plan.dates]).toEqual([["c", 102], ["a", 100], ["b", 101]]);
      expect(plan.insert).toEqual([
        { itemId: "c", addedAt: 102, replace: true },
        { itemId: "a", addedAt: 100, replace: true },
        { itemId: "b", addedAt: 101, replace: true },
      ]);
      expect(planAddedDates(new Map([["a", 100]]), ["a"], NOW, () => null, { ordered: true, pinned }).insert).toEqual([]);
    });

    it("un titre hors source au milieu prend la date du titre qui le précède, même à la première lecture", () => {
      const plan = planAddedDates(new Map(), ["a", "x", "b"], NOW, () => null, { ordered: true, pinned });
      expect(plan.dates.get("x")).toBe(100);
    });

    it("un vrai ajout fait ensuite dans Octave (en fin) reste daté maintenant", () => {
      const plan = planAddedDates(new Map([["a", 100], ["b", 101], ["c", 102]]), ["a", "b", "c", "n"], NOW, () => null, { ordered: true, pinned });
      expect(plan.dates.get("n")).toBe(NOW);
      expect(plan.insert).toEqual([{ itemId: "n", addedAt: NOW }]);
    });
  });
});
