import { describe, expect, it } from "vitest";
import { keyboardAvoidanceBehavior } from "./keyboardAvoidance";

describe("keyboardAvoidanceBehavior", () => {
  it("Android évite toujours le clavier (bord à bord : plus de redimensionnement)", () => {
    expect(keyboardAvoidanceBehavior("android", true)).toBe("padding");
    expect(keyboardAvoidanceBehavior("android", false)).toBe("padding");
  });

  it("iOS garde le réglage de l'écran", () => {
    expect(keyboardAvoidanceBehavior("ios", true)).toBe("padding");
    expect(keyboardAvoidanceBehavior("ios", false)).toBeUndefined();
  });

  it("ailleurs (web), rien", () => {
    expect(keyboardAvoidanceBehavior("web", true)).toBeUndefined();
  });
});
