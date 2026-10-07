import { describe, expect, it } from "vitest";
import { tierFromDeviceConstants } from "./nativeTier";

describe("le niveau tiré des constantes natives", () => {
  it("rend « normal » sans module natif (rien de lu)", () => {
    expect(tierFromDeviceConstants(undefined).state.tier).toBe("normal");
  });

  it("suit le forçage de débogage et les signaux simulés", () => {
    expect(tierFromDeviceConstants({ forcedTier: "1" }).state.tier).toBe("lite");
    const simulated = tierFromDeviceConstants({ signalOverride: "netplus" });
    expect(simulated.state.tier).toBe("lite");
    expect(simulated.override).not.toBeNull();
  });

  it("suit le réglage de l'utilisateur", () => {
    expect(tierFromDeviceConstants({ mode: "on" }).state.tier).toBe("lite");
    expect(tierFromDeviceConstants({ mode: "off", forcedTier: undefined }).state.tier).toBe("normal");
  });
});
