import { describe, expect, it } from "vitest";
import { canGoBack } from "./backOrHome";

describe("canGoBack", () => {
  it("revient en arrière dès qu'une entrée précède dans l'app", () => {
    expect(canGoBack({ idx: 2, key: "x" })).toBe(true);
  });
  it("renvoie à l'accueil sur la première page ou sans état", () => {
    expect(canGoBack({ idx: 0 })).toBe(false);
    expect(canGoBack(null)).toBe(false);
    expect(canGoBack({ usr: {} })).toBe(false);
  });
});
