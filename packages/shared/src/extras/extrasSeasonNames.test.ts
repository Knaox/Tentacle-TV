import { describe, expect, it } from "vitest";
import type { ExtraEntry } from "./extraEntries";
import { scopeName, withSeasonNames } from "./extrasSeasonNames";

const local = (itemId: string, subtitle = ""): ExtraEntry => ({ source: "local", key: `local-${itemId}`, itemId, title: itemId, subtitle });

describe("extras › le nom de la saison en tête des tuiles", () => {
  it("préfixe les extras locaux d'une saison, rien ailleurs ni sans carrousel mélangé", () => {
    const ownerOf = new Map([["a", "s2"], ["b", "serie"]]);
    const names = new Map([["s2", "Saison 2"]]);
    expect(withSeasonNames([local("a", "Coulisses"), local("b")], ownerOf, names).map((e) => e.subtitle)).toEqual(["Saison 2 · Coulisses", ""]);
    expect(withSeasonNames([local("a")], ownerOf, names)[0].subtitle).toBe("Saison 2");
    expect(withSeasonNames([local("a", "x")], ownerOf, null)[0].subtitle).toBe("x");
  });

  it("le nom d'une portée : une saison seulement", () => {
    const t = (key: string, options: { season: number }) => `${key}:${options.season}`;
    expect(scopeName(t, { kind: "season", season: 6 })).toBe("common:trailerScopeSeason:6");
    expect(scopeName(t, { kind: "series" })).toBeNull();
  });
});
