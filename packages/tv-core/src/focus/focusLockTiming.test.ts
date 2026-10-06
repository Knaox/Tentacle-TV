import { describe, expect, it } from "vitest";
import { focusLockWaitsForBlur } from "./focusLockTiming";

describe("focusLockWaitsForBlur — jamais de verrou sous le focus", () => {
  it("le verrou de la cible focalisée attend qu'elle perde le focus", () => {
    expect(focusLockWaitsForBlur(true, "back", "back")).toBe(true);
  });

  it("une cible sans le focus se verrouille tout de suite", () => {
    expect(focusLockWaitsForBlur(true, "back", "pairing:code")).toBe(false);
    expect(focusLockWaitsForBlur(true, "back", null)).toBe(false);
  });

  it("déverrouiller n'attend jamais", () => {
    expect(focusLockWaitsForBlur(false, "back", "back")).toBe(false);
  });
});
