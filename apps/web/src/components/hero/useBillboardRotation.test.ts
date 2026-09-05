import { describe, expect, it } from "vitest";
import { remainingInCycle } from "./useBillboardRotation";

describe("remainingInCycle", () => {
  it("cycle en cours : la rotation reprend là où elle en était", () => {
    expect(remainingInCycle(8000, 1000, 4000)).toBe(5000);
  });
  it("cycle écoulé (inactivité, retour à l'écran) : la diapositive suivante arrive aussitôt", () => {
    expect(remainingInCycle(8000, 1000, 30_000)).toBe(0);
  });
  it("à l'instant du début : un cycle entier", () => {
    expect(remainingInCycle(8000, 1000, 1000)).toBe(8000);
  });
});
