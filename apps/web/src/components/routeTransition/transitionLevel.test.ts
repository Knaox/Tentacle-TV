import { describe, expect, it, vi } from "vitest";
import { createTransitionLevel } from "./transitionLevel";

describe("le niveau de transition", () => {
  it("part d'une page en place, prête, sans rien qui sorte", () => {
    const level = createTransitionLevel();
    expect(level.arrival()).toEqual({ ready: true, instant: false });
    expect(level.leaving()).toBe(0);
  });

  it("prévient les pages qui sortent quand l'arrivée change d'état — pas quand elle le répète", () => {
    const level = createTransitionLevel();
    const listener = vi.fn();
    level.subscribe(listener);
    level.setArrival({ ready: false, instant: false });
    level.setArrival({ ready: false, instant: false });
    expect(listener).toHaveBeenCalledTimes(1);
    level.setArrival({ ready: true, instant: false });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(level.arrival().ready).toBe(true);
  });

  it("compte les pages qui sortent, et ne décompte chacune qu'une fois", () => {
    const level = createTransitionLevel();
    const first = level.enterLeaving();
    const second = level.enterLeaving();
    expect(level.leaving()).toBe(2);
    first();
    first();
    expect(level.leaving()).toBe(1);
    second();
    expect(level.leaving()).toBe(0);
  });

  it("un abonné retiré n'est plus prévenu", () => {
    const level = createTransitionLevel();
    const listener = vi.fn();
    const unsubscribe = level.subscribe(listener);
    unsubscribe();
    level.setArrival({ ready: false, instant: true });
    expect(listener).not.toHaveBeenCalled();
  });
});
