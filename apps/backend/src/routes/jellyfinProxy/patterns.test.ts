import { describe, it, expect } from "vitest";
import { isAllowedProxyPath } from "./patterns";

describe("isAllowedProxyPath — routes de session", () => {
  it("laisse passer le playstate", () => {
    expect(isAllowedProxyPath("Sessions/Playing")).toBe(true);
    expect(isAllowedProxyPath("Sessions/Playing/Progress")).toBe(true);
    expect(isAllowedProxyPath("Sessions/Playing/Stopped")).toBe(true);
  });

  it("refuse Sessions/Logout — le token d'un appareil jumelé est souvent partagé, un logout proxyfié tuerait le web et les TVs sœurs", () => {
    expect(isAllowedProxyPath("Sessions/Logout")).toBe(false);
  });

  it("refuse un chemin arbitraire", () => {
    expect(isAllowedProxyPath("System/Configuration")).toBe(false);
  });
});

describe("isAllowedProxyPath — mesure de débit", () => {
  it("laisse passer le téléchargement témoin BitrateTest (cap qualité des TVs, dev = tout via proxy)", () => {
    expect(isAllowedProxyPath("Playback/BitrateTest")).toBe(true);
  });
});

describe("isAllowedProxyPath — nouveautés de Jellyfin 12", () => {
  it("laisse passer « Fait partie de » (collections d'un titre) et les filtres de langues", () => {
    expect(isAllowedProxyPath("Items/abc/Collections")).toBe(true);
    expect(isAllowedProxyPath("Items/Filters2")).toBe(true);
  });

  it("n'ouvre pas pour autant la gestion des collections", () => {
    expect(isAllowedProxyPath("Collections")).toBe(false);
    expect(isAllowedProxyPath("Collections/abc/Items")).toBe(false);
  });
});

describe("isAllowedProxyPath — aucune remontée hors de la liste", () => {
  it("refuse un préfixe permis suivi de « .. », sous toutes ses formes", () => {
    for (const path of [
      "Items/x/Images/../../../System/Configuration",
      "Items/x/Images/%2e%2e/%2E%2E/System/Configuration",
      "Items/x/Images/%252e%252e/%252e%252e/Users",
      "Items/x/Images/..%2f..%2fAuth/Keys",
      "Items/x/Images/..\\..\\System/Configuration",
      "Genres/../Users",
      "Items/x/Images/./Primary",
    ]) expect(isAllowedProxyPath(path)).toBe(false);
  });

  it("garde les chemins légitimes, points et pourcentages compris", () => {
    for (const path of [
      "Items/abc/Images/Primary",
      "Videos/abc/def/Subtitles/0/Stream.vtt",
      "Persons/John%20Doe",
      "Genres/Science-Fiction %26 Fantastique",
      "Studios/100%",
    ]) expect(isAllowedProxyPath(path)).toBe(true);
  });
});
