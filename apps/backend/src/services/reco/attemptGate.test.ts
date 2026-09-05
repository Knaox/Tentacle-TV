import { describe, expect, it } from "vitest";
import { AttemptGate } from "./attemptGate";

describe("AttemptGate", () => {
  it("accorde la première tentative, refuse la suivante sous l'intervalle", () => {
    const gate = new AttemptGate(120_000);
    expect(gate.tryAcquire("u1", 1_000)).toBe(true);
    expect(gate.tryAcquire("u1", 1_000 + 119_999)).toBe(false);
    expect(gate.tryAcquire("u1", 1_000 + 120_000)).toBe(true);
  });

  it("les clés sont indépendantes, et release libère tout de suite", () => {
    const gate = new AttemptGate(120_000);
    expect(gate.tryAcquire("u1", 1_000)).toBe(true);
    expect(gate.tryAcquire("u2", 1_000)).toBe(true);
    gate.release("u1");
    expect(gate.tryAcquire("u1", 1_001)).toBe(true);
    expect(gate.tryAcquire("u2", 1_001)).toBe(false);
  });
});
