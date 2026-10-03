import { describe, expect, it } from "vitest";

import { backCrossBandArmed, backCrossDownTarget, backCrossFreedBy, backCrossLockedOnArrival, backCrossRemembers } from "./backCross";

describe("backCross — la croix Retour d'un écran", () => {
  it("verrouillée à l'arrivée, sauf quand elle est l'entrée (seule action)", () => {
    expect(backCrossLockedOnArrival("detail:primary", "detail:back")).toBe(true);
    expect(backCrossLockedOnArrival(null, "detail:back")).toBe(true);
    expect(backCrossLockedOnArrival("browse:back", "browse:back")).toBe(false);
  });

  it("libérée par le focus de n'importe quelle autre clé, navigation comprise", () => {
    expect(backCrossFreedBy("detail:primary", "detail:back")).toBe(true);
    expect(backCrossFreedBy("nav:Search", "browse:back")).toBe(true);
    expect(backCrossFreedBy("detail:back", "detail:back")).toBe(false);
  });

  it("BAS se souvient du contenu, jamais de la navigation", () => {
    expect(backCrossRemembers("similar:3")).toBe(true);
    expect(backCrossRemembers("nav:Home")).toBe(false);
  });

  it("la bande vise la croix : libre, et focus hors de la navigation (aucun focus compris)", () => {
    expect(backCrossBandArmed(false, "detail:primary")).toBe(true);
    expect(backCrossBandArmed(false, null)).toBe(true);
    expect(backCrossBandArmed(false, "nav:Search")).toBe(false);
    expect(backCrossBandArmed(true, "detail:primary")).toBe(false);
  });

  it("BAS depuis la croix : la dernière cible de contenu montée, sinon l'entrée, jamais la croix", () => {
    const backKey = "detail:back";
    expect(backCrossDownTarget({ lastContent: "cast:2", lastContentMounted: true, entryKey: "detail:primary", backKey })).toBe("cast:2");
    expect(backCrossDownTarget({ lastContent: "cast:2", lastContentMounted: false, entryKey: "detail:primary", backKey })).toBe("detail:primary");
    expect(backCrossDownTarget({ lastContent: null, lastContentMounted: false, entryKey: backKey, backKey })).toBeNull();
    expect(backCrossDownTarget({ lastContent: null, lastContentMounted: false, entryKey: null, backKey })).toBeNull();
  });
});
