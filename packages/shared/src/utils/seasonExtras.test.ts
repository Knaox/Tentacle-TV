import { describe, expect, it } from "vitest";
import { seasonHasExtras } from "./seasonExtras";

describe("seasonHasExtras", () => {
  it("n'interroge que les saisons qui ont des extras ou des bandes-annonces", () => {
    expect(seasonHasExtras({ SpecialFeatureCount: 0, RemoteTrailers: [] })).toBe(false);
    expect(seasonHasExtras({ SpecialFeatureCount: 2 })).toBe(true);
    expect(seasonHasExtras({ SpecialFeatureCount: 0, RemoteTrailers: [{ Url: "https://youtu.be/x" }] })).toBe(true);
  });

  it("sans compteur (serveur qui ne le sert pas), garde l'ancienne conduite : demander", () => {
    expect(seasonHasExtras({})).toBe(true);
  });
});
