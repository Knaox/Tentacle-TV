import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginRouteHold, isRouteHeld, resetRouteHoldForTests, subscribeRouteHold } from "./routeHold";

describe("une navigation qui attend", () => {
  beforeEach(resetRouteHoldForTests);

  it("rien n'attend au départ", () => {
    expect(isRouteHeld()).toBe(false);
  });

  it("attend tant qu'une page quittée est tenue, et le dit à ses abonnés", () => {
    const listener = vi.fn();
    subscribeRouteHold(listener);
    const end = beginRouteHold();
    expect(isRouteHeld()).toBe(true);
    end();
    expect(isRouteHeld()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("deux niveaux à la fois (la coquille et sa section) : l'attente dure jusqu'au dernier", () => {
    const first = beginRouteHold();
    const second = beginRouteHold();
    first();
    first();
    expect(isRouteHeld()).toBe(true);
    second();
    expect(isRouteHeld()).toBe(false);
  });
});
