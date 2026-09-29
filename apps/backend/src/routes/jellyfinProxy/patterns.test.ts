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
