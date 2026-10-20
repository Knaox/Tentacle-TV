import { describe, expect, it } from "vitest";
import { isAccountOfflineRoute, isServerOnlyRoute } from "./offlineRoutes";

describe("offlineRoutes", () => {
  it("« Sur cet appareil » et ses fiches locales sont au compte de l'appareil", () => {
    expect(isAccountOfflineRoute(["on-device"])).toBe(true);
    expect(isAccountOfflineRoute(["on-device", "item", "[itemId]"])).toBe(true);
    expect(isAccountOfflineRoute(["on-device", "series", "[seriesKey]"])).toBe(true);
    expect(isAccountOfflineRoute(["(tabs)"])).toBe(false);
    expect(isAccountOfflineRoute(["watch", "[itemId]"])).toBe(false);
  });

  it("le catalogue local n'est jamais une route du serveur", () => {
    expect(isServerOnlyRoute(["on-device"])).toBe(false);
    expect(isServerOnlyRoute(["media", "[itemId]"])).toBe(true);
  });
});
