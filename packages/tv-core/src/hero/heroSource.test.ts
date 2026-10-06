import { describe, expect, it } from "vitest";

import { heroItemsFrom, heroModeOf, heroSourceFor, type HeroInputs } from "./heroSource";

const ALL: HeroInputs<string> = { resume: ["r1", "r2"], featured: ["f1", "f2", "f3", "f4", "f5", "f6"], fixed: "x", reco: ["c1", "c2"] };

describe("la source du héros, selon le mode gardé par le serveur", () => {
  it("suit le mode du compte, comme le web et le mobile", () => {
    expect(heroSourceFor("resume", ALL)).toBe("resume");
    expect(heroSourceFor("random", ALL)).toBe("featured");
    expect(heroSourceFor("fixed", ALL)).toBe("fixed");
    expect(heroSourceFor("reco", ALL)).toBe("reco");
    expect(heroItemsFrom("featured", ALL)).toEqual(["f1", "f2", "f3", "f4", "f5"]);
    expect(heroItemsFrom("fixed", ALL)).toEqual(["x"]);
  });

  it("retombe sur la reprise, sinon la sélection, quand le mode n'a rien", () => {
    expect(heroSourceFor("reco", { ...ALL, reco: [] })).toBe("resume");
    expect(heroSourceFor("fixed", { ...ALL, fixed: null })).toBe("resume");
    expect(heroSourceFor("resume", { ...ALL, resume: [] })).toBe("featured");
  });

  it("attend ce que le mode attend, au plus jusqu'à l'échéance", () => {
    expect(heroSourceFor(null, ALL)).toBeNull();
    expect(heroSourceFor("reco", { ...ALL, reco: undefined })).toBeNull();
    expect(heroSourceFor("reco", { ...ALL, reco: undefined }, { waitedOut: true })).toBe("resume");
    expect(heroSourceFor("fixed", { ...ALL, fixed: undefined })).toBeNull();
    expect(heroSourceFor("fixed", { ...ALL, fixed: undefined }, { waitedOut: true })).toBe("resume");
    // La reprise ne se devine pas : elle s'attend toujours.
    expect(heroSourceFor("resume", { ...ALL, resume: undefined }, { waitedOut: true })).toBeNull();
    expect(heroSourceFor("random", { ...ALL, featured: undefined })).toBeNull();
  });

  it("garde la source déjà montrée tant que le mode ne change pas", () => {
    const previous = { mode: "reco" as const, source: "resume" as const };
    expect(heroSourceFor("reco", ALL, { previous })).toBe("resume");
    // La source montrée s'est vidée : le mode reprend la main.
    expect(heroSourceFor("reco", { ...ALL, resume: [] }, { previous })).toBe("reco");
    // Le compte a changé de mode ailleurs : le héros le suit.
    expect(heroSourceFor("random", ALL, { previous })).toBe("featured");
  });

  it("lit le mode du serveur, la reprise par défaut si la mise en page manque", () => {
    expect(heroModeOf({ heroMode: "reco" }, false)).toBe("reco");
    expect(heroModeOf(undefined, false)).toBeNull();
    expect(heroModeOf(undefined, true)).toBe("resume");
    expect(heroModeOf({ heroMode: "carrousel" }, false)).toBe("resume");
  });
});
