import { describe, expect, it } from "vitest";
import { heroSlideNeedsArtwork, heroSlideSource } from "./heroSlideSource";

const base = { wide: "W", poster: "P", portrait: false, artwork: undefined, failed: [] as string[] };

describe("heroSlideSource", () => {
  it("paysage : le large tant qu'il tient, sans rien demander", () => {
    expect(heroSlideSource(base)).toBe("W");
    expect(heroSlideNeedsArtwork(base)).toBe(false);
  });

  it("paysage, large en 404 : on attend le repli (rien), puis TMDB avant l'affiche", () => {
    const failed = ["W"];
    expect(heroSlideNeedsArtwork({ ...base, failed })).toBe(true);
    expect(heroSlideSource({ ...base, failed })).toBeNull();
    expect(heroSlideSource({ ...base, failed, artwork: ["TMDB", "J2"] })).toBe("TMDB");
    expect(heroSlideSource({ ...base, failed: ["W", "TMDB", "J2"], artwork: ["TMDB", "J2"] })).toBe("P");
  });

  it("paysage sans large annoncé : le repli d'abord ; serveur sans repli → l'affiche", () => {
    expect(heroSlideSource({ ...base, wide: null, artwork: [] })).toBe("P");
  });

  it("portrait : l'affiche, puis le large ; le repli seulement si les deux manquent", () => {
    expect(heroSlideSource({ ...base, portrait: true })).toBe("P");
    expect(heroSlideNeedsArtwork({ ...base, portrait: true, failed: ["P"] })).toBe(false);
    expect(heroSlideNeedsArtwork({ ...base, portrait: true, failed: ["P", "W"] })).toBe(true);
    expect(heroSlideSource({ ...base, portrait: true, failed: ["P", "W"], artwork: ["J"] })).toBe("J");
  });
});
