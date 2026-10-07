import { describe, expect, it } from "vitest";
import { proxyErrorLevel } from "./errorLogLevel";

describe("proxyErrorLevel", () => {
  it("la photo absente d'un compte n'est pas un avertissement", () => {
    expect(proxyErrorLevel(404, "Users/d4626156e3fb4eeb93e2e56bff96667c/Images/Primary")).toBe("debug");
    expect(proxyErrorLevel(404, "users/abc/images/Primary/0")).toBe("debug");
  });

  it("le reste en reste un : autre statut, image d'un titre, autre route du compte", () => {
    expect(proxyErrorLevel(500, "Users/abc/Images/Primary")).toBe("warn");
    expect(proxyErrorLevel(404, "Items/abc/Images/Primary")).toBe("warn");
    expect(proxyErrorLevel(404, "Users/abc/Items/def")).toBe("warn");
  });
});
