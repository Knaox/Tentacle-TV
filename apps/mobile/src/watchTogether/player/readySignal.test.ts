import { describe, expect, it } from "vitest";
import { planReadySignal, READY_STABLE_MS } from "./readySignal";

describe("planReadySignal", () => {
  it("se tait tant que le média n'est pas chargé", () => {
    expect(planReadySignal({ ready: false, buffering: true, seeking: false })).toBeNull();
  });

  it("dit « je cale » tout de suite en tampon", () => {
    expect(planReadySignal({ ready: true, buffering: true, seeking: true })).toEqual({ buffering: true, delayMs: 0 });
  });

  it("ne dit rien pendant un saut en vol (ni « je cale », ni « prêt »)", () => {
    expect(planReadySignal({ ready: true, buffering: false, seeking: true })).toBeNull();
  });

  it("dit « prêt » après une lecture stable", () => {
    expect(planReadySignal({ ready: true, buffering: false, seeking: false })).toEqual({ buffering: false, delayMs: READY_STABLE_MS });
  });
});
