import { describe, expect, it } from "vitest";
import { effectiveIncludeVigie } from "./vigieSetting";

describe("le réglage « hors bibliothèque » effectif", () => {
  it("suit le réglage du compte quand Vigie est disponible", () => {
    expect(effectiveIncludeVigie(true, true)).toBe(true);
    expect(effectiveIncludeVigie(false, true)).toBe(false);
  });

  it("vaut vrai par défaut (compte sans réglage) avec Vigie", () => {
    expect(effectiveIncludeVigie(undefined, true)).toBe(true);
    expect(effectiveIncludeVigie(null, true)).toBe(true);
  });

  it("est toujours faux sans Vigie, même activé par l'utilisateur", () => {
    expect(effectiveIncludeVigie(true, false)).toBe(false);
    expect(effectiveIncludeVigie(undefined, false)).toBe(false);
  });
});
