import { describe, expect, it } from "vitest";
import { KEEP_WITHIN_CHECK_MS, keepWithinReclaim, keepWithinStep, startKeepWithin } from "./keepWithin";

const own = (key: string) => key.startsWith("offline:");

describe("keepWithin — garder le focus dans une surface plein écran", () => {
  it("l'entrée est la première clé à rendre ; la perte se juge après 50 ms", () => {
    expect(startKeepWithin("offline:retry")).toEqual({ last: "offline:retry" });
    expect(KEEP_WITHIN_CHECK_MS).toBe(50);
  });

  it("une clé de la surface qui prend le focus devient la dernière ; la vérification s'annule", () => {
    expect(keepWithinStep(startKeepWithin("offline:retry"), "offline:unpair", true, own)).toEqual({ kind: "held", state: { last: "offline:unpair" } });
  });

  it("une clé de la surface qui le perd : vérifier", () => {
    expect(keepWithinStep(startKeepWithin("offline:retry"), "offline:retry", false, own)).toEqual({ kind: "check" });
  });

  it("une clé d'ailleurs : rien", () => {
    expect(keepWithinStep(startKeepWithin("offline:retry"), "status:primary", true, own)).toEqual({ kind: "ignore" });
    expect(keepWithinStep(startKeepWithin("offline:retry"), "status:primary", false, own)).toEqual({ kind: "ignore" });
  });

  it("à la vérification : le focus ailleurs, ou nulle part, ramène la dernière clé", () => {
    const state = { last: "offline:unpair" };
    expect(keepWithinReclaim(state, "status:primary", own)).toBe("offline:unpair");
    expect(keepWithinReclaim(state, null, own)).toBe("offline:unpair");
    expect(keepWithinReclaim(state, "offline:retry", own)).toBeNull();
  });
});
