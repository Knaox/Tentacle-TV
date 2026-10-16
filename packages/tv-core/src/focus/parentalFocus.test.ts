import { describe, expect, it } from "vitest";
import { PARENTAL_BACK_KEY, parentalAgeChipKey, parentalEntryKey, parentalGuardedKeys, parentalLibraryRowKey } from "./parentalFocus";

describe("parentalEntryKey", () => {
  it("le palier retenu d'abord", () => {
    expect(parentalEntryKey({ ageKey: "age:12", libraryCount: 3 })).toBe(parentalAgeChipKey("age:12"));
  });

  it("sans âge (serveur qui ne le permet pas) : la première bibliothèque", () => {
    expect(parentalEntryKey({ ageKey: null, libraryCount: 3 })).toBe(parentalLibraryRowKey(0));
  });

  it("ni l'un ni l'autre : la croix, jamais une impasse", () => {
    expect(parentalEntryKey({ ageKey: null, libraryCount: 0 })).toBe(PARENTAL_BACK_KEY);
  });
});

describe("parentalGuardedKeys", () => {
  it("garde chaque palier, le réglage fait ailleurs et les lignes", () => {
    const keys = parentalGuardedKeys();
    expect(keys).toEqual(expect.arrayContaining([parentalAgeChipKey("age:0"), parentalAgeChipKey("none"), parentalAgeChipKey("custom"), parentalLibraryRowKey(0)]));
    expect(keys).not.toContain(PARENTAL_BACK_KEY);
  });
});
