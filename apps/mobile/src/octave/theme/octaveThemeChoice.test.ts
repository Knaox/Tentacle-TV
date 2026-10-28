import { describe, expect, it } from "vitest";
import { octaveGlassEnabled, octaveSchemeOf } from "./octaveThemeChoice";

describe("apparence d'Octave", () => {
  it("« Comme Tentacle » ne force rien ; clair et sombre s'imposent au mode musique", () => {
    expect(octaveSchemeOf("same")).toBeNull();
    expect(octaveSchemeOf("light")).toBe("light");
    expect(octaveSchemeOf("dark")).toBe("dark");
  });

  it("le verre d'Octave n'existe que là où le verre natif existe", () => {
    expect(octaveGlassEnabled(true, true)).toBe(true);
    expect(octaveGlassEnabled(true, false)).toBe(false);
    expect(octaveGlassEnabled(false, true)).toBe(false);
  });
});
