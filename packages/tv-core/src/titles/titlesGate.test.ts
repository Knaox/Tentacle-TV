import { describe, expect, it } from "vitest";
import type { TitleProvider } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH, myTitlesRefetchMs, titlesFeaturesOpen } from "./titlesGate";

const provider: TitleProvider = {
  pluginId: "seer",
  statePath: "/titles/state",
  requestPath: "/titles/request",
  accessPath: "/titles/access",
  minePath: "/titles/mine",
};

describe("la garde des fonctions d'une extension de demandes", () => {
  it("s'ouvre avec une extension qui déclare le droit, et un droit ouvert", () => {
    expect(titlesFeaturesOpen(provider, { request: true })).toBe(true);
  });

  it("reste fermée sans extension, sans droit déclaré, ou compte bloqué", () => {
    expect(titlesFeaturesOpen(null, { request: true })).toBe(false);
    expect(titlesFeaturesOpen({ ...provider, accessPath: null }, { request: true })).toBe(false);
    expect(titlesFeaturesOpen(provider, { request: false })).toBe(false);
  });

  it("reste fermée tant que le droit n'est pas lu", () => {
    expect(titlesFeaturesOpen(provider, null)).toBe(false);
    expect(titlesFeaturesOpen(provider, undefined)).toBe(false);
  });
});

describe("le rythme du suivi", () => {
  it("relit souvent la liste ouverte, rarement le rail seul", () => {
    expect(myTitlesRefetchMs(true)).toBe(30_000);
    expect(myTitlesRefetchMs(false)).toBe(5 * 60_000);
    expect(MY_TITLES_REFRESH.staleMs).toBeLessThan(MY_TITLES_REFRESH.idleMs);
  });
});
