import { describe, expect, it } from "vitest";
import { msUntilNextUtcMidnight } from "./pageSchedule";

describe("msUntilNextUtcMidnight", () => {
  it("une seconde avant minuit, mille millisecondes ; à minuit pile, un jour entier", () => {
    expect(msUntilNextUtcMidnight(Date.parse("2026-09-04T23:59:59.000Z"))).toBe(1_000);
    expect(msUntilNextUtcMidnight(Date.parse("2026-09-04T00:00:00.000Z"))).toBe(24 * 3600_000);
  });
});
