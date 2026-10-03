import { describe, expect, it } from "vitest";
import { createPressGuard } from "./pressGuard";

describe("la garde anti-clic fantôme", () => {
  it("ignore, sur un élément gardé, l'OK qui n'a pas commencé dessus", () => {
    const guard = createPressGuard();
    expect(guard.press(true)).toBe(false);
  });

  it("compte l'OK commencé sur l'élément, et le consomme", () => {
    const guard = createPressGuard();
    guard.pressIn();
    expect(guard.press(true)).toBe(true);
    expect(guard.press(true)).toBe(false);
  });

  it("oublie l'appui commencé quand l'élément perd le focus — et dit qu'il y en avait un", () => {
    const guard = createPressGuard();
    guard.pressIn();
    expect(guard.blur()).toBe(true);
    expect(guard.press(true)).toBe(false);
    expect(guard.blur()).toBe(false);
  });

  it("compte tout OK sur un élément non gardé, et consomme l'appui commencé", () => {
    const guard = createPressGuard();
    expect(guard.press(false)).toBe(true);
    guard.pressIn();
    expect(guard.press(false)).toBe(true);
    expect(guard.press(true)).toBe(false);
  });
});
