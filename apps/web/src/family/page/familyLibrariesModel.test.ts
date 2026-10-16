import { describe, expect, it } from "vitest";
import { draftVerdict, initialDraft, isChecked, toggleAll, toggleLibrary } from "./familyLibrariesModel";

const AVAILABLE = [{ id: "films" }, { id: "series" }, { id: "anime" }];

describe("les bibliothèques d'un profil, en cours de réglage", () => {
  it("part de la liste du serveur, sans ce que le profil ne peut plus voir", () => {
    expect(initialDraft(null, AVAILABLE)).toBeNull();
    expect(initialDraft(["films", "gone"], AVAILABLE)).toEqual(["films"]);
  });

  it("« Toutes » décoché coche chacune ; recoché, revient à « toutes »", () => {
    expect(toggleAll(null, AVAILABLE)).toEqual(["films", "series", "anime"]);
    expect(toggleAll(["films"], AVAILABLE)).toBeNull();
  });

  it("sous « Toutes », chacune est cochée et ne se décoche pas seule", () => {
    expect(isChecked(null, "anime")).toBe(true);
    expect(toggleLibrary(null, "anime")).toBeNull();
    expect(toggleLibrary(["films", "anime"], "anime")).toEqual(["films"]);
    expect(toggleLibrary(["films"], "series")).toEqual(["films", "series"]);
  });

  it("n'envoie ni un brouillon inchangé, ni une liste vide", () => {
    expect(draftVerdict(["films", "series"], ["series", "films"])).toBe("unchanged");
    expect(draftVerdict([], ["films"])).toBe("empty");
    expect(draftVerdict(["films"], null)).toBe("ready");
    expect(draftVerdict(null, ["films"])).toBe("ready");
  });
});
