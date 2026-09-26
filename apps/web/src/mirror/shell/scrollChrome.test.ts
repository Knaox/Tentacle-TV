import { describe, expect, it } from "vitest";
import { nextCollapsed } from "./scrollChrome";

describe("repli du chrome au défilement", () => {
  it("près du haut, le chrome est toujours plein", () => {
    expect(nextCollapsed(true, 40, 30)).toBe(false);
  });
  it("douze pixels vers le bas replient, douze vers le haut déploient", () => {
    expect(nextCollapsed(false, 400, 13)).toBe(true);
    expect(nextCollapsed(true, 400, -13)).toBe(false);
  });
  it("un petit pas ne change rien", () => {
    expect(nextCollapsed(true, 400, 5)).toBe(true);
    expect(nextCollapsed(false, 400, -5)).toBe(false);
  });
});
