import { describe, it, expect } from "vitest";
import { trimTrailingSlashes } from "./trailingSlashes";

describe("trimTrailingSlashes", () => {
  it("retire tous les / finaux, et eux seuls", () => {
    expect(trimTrailingSlashes("https://a.b/c///")).toBe("https://a.b/c");
    expect(trimTrailingSlashes("https://a.b/c")).toBe("https://a.b/c");
    expect(trimTrailingSlashes("///")).toBe("");
    expect(trimTrailingSlashes("")).toBe("");
  });

  it("reste linéaire sur une longue suite de / suivie d'un autre caractère", () => {
    const hostile = `${"/".repeat(200_000)}a`;
    const started = performance.now();
    expect(trimTrailingSlashes(hostile)).toBe(hostile);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
