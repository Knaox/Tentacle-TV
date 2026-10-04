import { describe, expect, it } from "vitest";
import { createBackTakers } from "./backTakers";

describe("createBackTakers — le Retour d'Android TV, pris au geste", () => {
  it("propose le Retour du dernier inscrit au premier, et s'arrête au premier qui le prend", () => {
    const takers = createBackTakers();
    const calls: string[] = [];
    takers.add(() => (calls.push("écran"), true));
    takers.add(() => (calls.push("panneau"), false));
    expect(takers.take()).toBe(true);
    expect(calls).toEqual(["panneau", "écran"]);
  });

  it("rend faux quand personne ne le prend — la suite (navigateur, sortie) décide", () => {
    const takers = createBackTakers();
    expect(takers.take()).toBe(false);
    takers.add(() => false);
    expect(takers.take()).toBe(false);
  });

  it("retire un preneur une seule fois, et prévient du premier arrivé comme du dernier parti", () => {
    const takers = createBackTakers();
    const demand: boolean[] = [];
    takers.onDemand((needed) => demand.push(needed));
    const first = takers.add(() => true);
    const second = takers.add(() => false);
    first();
    first();
    expect(takers.take()).toBe(false);
    second();
    expect(demand).toEqual([true, false]);
  });
});
