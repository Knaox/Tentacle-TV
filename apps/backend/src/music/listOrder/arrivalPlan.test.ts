import { describe, expect, it } from "vitest";
import { planArrivalDates } from "./arrivalPlan";

const identities: Record<string, string> = { a: "rec-a", b: "rec-b", x: "rec-x", x2: "rec-x" };
const identity = (id: string) => identities[id] ?? null;

describe("date d'une arrivée posée par l'extension", () => {
  it("posée en fin de playlist : la date de l'entrée qui la précède, jamais « maintenant »", () => {
    const known = new Map([["a", 100], ["b", 200]]);
    const dates = planArrivalDates({ known, before: ["a", "b"], inserted: ["x"], at: 2, identity });
    expect(dates).toEqual(new Map([["x", 200]]));
  });

  it("posée au milieu : la date de sa place", () => {
    const known = new Map([["a", 100], ["b", 200]]);
    expect(planArrivalDates({ known, before: ["a", "b"], inserted: ["x"], at: 1, identity }).get("x")).toBe(100);
  });

  it("en tête : la date de l'entrée qui suit", () => {
    const known = new Map([["a", 100]]);
    expect(planArrivalDates({ known, before: ["a"], inserted: ["x"], at: 0, identity }).get("x")).toBe(100);
  });

  it("un fichier remplacé (même enregistrement) hérite de la date de l'ancien élément", () => {
    const known = new Map([["a", 100], ["x", 150], ["b", 200]]);
    expect(planArrivalDates({ known, before: ["a", "x", "b"], inserted: ["x2"], at: 2, identity }).get("x2")).toBe(150);
  });

  it("un élément déjà daté ne change pas ; une playlist jamais lue n'est pas datée ici", () => {
    expect(planArrivalDates({ known: new Map([["x", 5]]), before: ["x"], inserted: ["x"], at: 0, identity }).size).toBe(0);
    expect(planArrivalDates({ known: new Map(), before: ["a"], inserted: ["x"], at: 1, identity }).size).toBe(0);
  });

  it("la date de la demande, quand l'extension la dit, l'emporte sur tout", () => {
    const known = new Map([["a", 100], ["x", 150]]);
    expect(planArrivalDates({ known, before: ["a", "x"], inserted: ["x2"], at: 0, identity, addedAt: 999 }).get("x2")).toBe(999);
  });
});
