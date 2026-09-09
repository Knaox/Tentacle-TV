/**
 * Le partage équitable d'un budget : nul ne reçoit plus qu'il ne demande, les
 * affamés se partagent le reste à parts égales, et la somme ne dépasse jamais
 * le budget.
 */

import { describe, expect, it } from "vitest";
import { allocate, waterFill, type UserDemand } from "./allocation";

const flows = (...demands: number[]) => demands.map((demand, id) => ({ id, demand }));

describe("waterFill", () => {
  it("deux affamés se partagent le budget en deux", () => {
    expect(waterFill(100, [Infinity, Infinity])).toEqual([50, 50]);
  });

  it("un demandeur modeste est servi, l'affamé prend le reste", () => {
    expect(waterFill(100, [10, Infinity])).toEqual([10, 90]);
  });

  it("personne ne reçoit plus qu'il ne demande, même avec du budget en trop", () => {
    expect(waterFill(100, [10, 20])).toEqual([10, 20]);
  });

  it("moins d'octets que de bouches : un octet chacun, dans l'ordre, puis stop", () => {
    expect(waterFill(5, [Infinity, Infinity, Infinity])).toEqual([2, 2, 1]);
    expect(waterFill(2, [Infinity, Infinity, Infinity])).toEqual([1, 1, 0]);
  });

  it("une demande nulle ne reçoit rien, un budget nul ne donne rien", () => {
    expect(waterFill(100, [0, Infinity])).toEqual([0, 100]);
    expect(waterFill(0, [Infinity, 10])).toEqual([0, 0]);
    expect(waterFill(100, [])).toEqual([]);
  });

  it("la somme des parts ne dépasse jamais le budget", () => {
    for (const [budget, demands] of [
      [7, [3, 3, 3]],
      [1000, [Infinity, 1, 999]],
      [33, [Infinity, Infinity, 5, 0]],
    ] as const) {
      const total = waterFill(budget, demands).reduce((sum, share) => sum + share, 0);
      expect(total).toBeLessThanOrEqual(budget);
    }
  });
});

describe("allocate", () => {
  it("un compte à deux transferts partage SA part, l'autre compte garde la sienne", () => {
    const users: UserDemand[] = [
      { userId: "a", flows: [{ id: 1, demand: Infinity }, { id: 2, demand: Infinity }] },
      { userId: "b", flows: [{ id: 3, demand: Infinity }] },
    ];
    const grants = allocate(600, users);
    expect(grants.get(1)).toBe(150);
    expect(grants.get(2)).toBe(150);
    expect(grants.get(3)).toBe(300);
  });

  it("ce qu'un transfert modeste laisse revient à son compte, puis aux autres", () => {
    const users: UserDemand[] = [
      { userId: "a", flows: [{ id: 1, demand: 50 }, { id: 2, demand: Infinity }] },
      { userId: "b", flows: [{ id: 3, demand: Infinity }] },
    ];
    const grants = allocate(600, users);
    expect(grants.get(1)).toBe(50);
    expect(grants.get(2)).toBe(250);
    expect(grants.get(3)).toBe(300);
  });

  it("un compte lent qui ne demande presque rien laisse tout aux affamés", () => {
    const users: UserDemand[] = [
      { userId: "a", flows: flows(8) },
      { userId: "b", flows: [{ id: 9, demand: Infinity }] },
    ];
    const grants = allocate(1000, users);
    expect(grants.get(0)).toBe(8);
    expect(grants.get(9)).toBe(992);
  });

  it("sans compte, rien n'est accordé", () => {
    expect(allocate(1000, []).size).toBe(0);
  });
});
