import { describe, it, expect } from "vitest";
import { isAllowedProxyPath } from "./patterns";

describe("isAllowedProxyPath — routes de session", () => {
  it("laisse passer le playstate", () => {
    expect(isAllowedProxyPath("Sessions/Playing")).toBe(true);
    expect(isAllowedProxyPath("Sessions/Playing/Progress")).toBe(true);
    expect(isAllowedProxyPath("Sessions/Playing/Stopped")).toBe(true);
  });

  it("refuse Sessions/Logout — le token d'un appareil jumelé est souvent partagé, un logout proxyfié tuerait le web et les TVs sœurs", () => {
    expect(isAllowedProxyPath("Sessions/Logout")).toBe(false);
  });

  it("refuse un chemin arbitraire", () => {
    expect(isAllowedProxyPath("System/Configuration")).toBe(false);
  });
});
