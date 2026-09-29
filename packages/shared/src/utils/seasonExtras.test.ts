import { describe, expect, it } from "vitest";
import { localExtrasToFetch, seasonHasExtras } from "./seasonExtras";

describe("seasonHasExtras", () => {
  it("n'interroge que les saisons qui ont des extras ou des bandes-annonces", () => {
    expect(seasonHasExtras({ SpecialFeatureCount: 0, RemoteTrailers: [] })).toBe(false);
    expect(seasonHasExtras({ SpecialFeatureCount: 2 })).toBe(true);
    expect(seasonHasExtras({ SpecialFeatureCount: 0, RemoteTrailers: [{ Url: "https://youtu.be/x" }] })).toBe(true);
  });

  it("montre la saison qui n'a qu'une bande-annonce locale (`Season 02/trailers/`)", () => {
    expect(seasonHasExtras({ SpecialFeatureCount: 0, LocalTrailerCount: 1, RemoteTrailers: [] })).toBe(true);
    expect(seasonHasExtras({ SpecialFeatureCount: 0, LocalTrailerCount: 0, RemoteTrailers: [] })).toBe(false);
  });

  it("sans compteur (serveur qui ne le sert pas), garde l'ancienne conduite : demander", () => {
    expect(seasonHasExtras({})).toBe(true);
  });
});

describe("localExtrasToFetch", () => {
  it("ne demande pas une liste que le compteur dit vide", () => {
    expect(localExtrasToFetch({ LocalTrailerCount: 0, SpecialFeatureCount: 2 })).toEqual({ trailers: false, features: true });
    expect(localExtrasToFetch({ LocalTrailerCount: 1, SpecialFeatureCount: 0 })).toEqual({ trailers: true, features: false });
  });

  it("sans compteur, demande ; sans titre, rien", () => {
    expect(localExtrasToFetch({})).toEqual({ trailers: true, features: true });
    expect(localExtrasToFetch(undefined)).toEqual({ trailers: false, features: false });
  });
});
