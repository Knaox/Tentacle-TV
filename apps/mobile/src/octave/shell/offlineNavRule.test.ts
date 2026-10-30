import { describe, expect, it } from "vitest";
import { visibleNavItems } from "./offlineNavRule";

const items = [{ tab: "home" }, { tab: "library" }, { tab: "offline" }] as const;

describe("visibleNavItems — l'onglet « Hors ligne »", () => {
  it("avec le droit du compte de l'appareil : toutes les entrées, dans l'ordre", () => {
    expect(visibleNavItems(items, true).map((i) => i.tab)).toEqual(["home", "library", "offline"]);
  });

  it("sans le droit, ou en session de profil : jamais « Hors ligne »", () => {
    expect(visibleNavItems(items, false).map((i) => i.tab)).toEqual(["home", "library"]);
  });
});
