import { describe, expect, it } from "vitest";
import { isProfileSplit, masterWidth } from "./panes";

describe("mise en page du profil miroir", () => {
  it("maître-détail dès 720 de largeur utile sur tablette", () => {
    expect(isProfileSplit(true, 744, 0)).toBe(true);
    expect(isProfileSplit(true, 780, 76)).toBe(false);
    expect(isProfileSplit(false, 1200, 0)).toBe(false);
    expect(masterWidth(744)).toBe(320);
    expect(masterWidth(1024)).toBe(348);
    expect(masterWidth(1366)).toBe(400);
  });
});
