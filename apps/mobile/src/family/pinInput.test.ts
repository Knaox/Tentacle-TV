import { describe, expect, it } from "vitest";
import { pinDigits, pinEntryProblem } from "./pinInput";

describe("saisie du code PIN", () => {
  it("ne garde que quatre chiffres, collage espacé compris", () => {
    expect(pinDigits("12 34")).toBe("1234");
    expect(pinDigits("1a2b3c4d5")).toBe("1234");
    expect(pinDigits("٣٤")).toBe("");
  });

  it("exige quatre chiffres, puis deux saisies identiques", () => {
    expect(pinEntryProblem("123", "123")).toBe("format");
    expect(pinEntryProblem("1234", "1243")).toBe("mismatch");
    expect(pinEntryProblem("1234", "1234")).toBeNull();
  });
});
