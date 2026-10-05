import { describe, expect, it } from "vitest";
import { ROUTER_GUIDES, ROUTER_GUIDES_VERIFIED_ON, routerGuide, routerGuideUrl } from "./routerGuides";

describe("guides des box", () => {
  it("un identifiant par opérateur, les sept de la liste", () => {
    expect(ROUTER_GUIDES.map((g) => g.id)).toEqual(["swisscom", "sunrise", "salt", "free", "orange", "sfr", "bouygues"]);
  });

  it("toutes les pages et sources sont en https://", () => {
    for (const g of ROUTER_GUIDES) {
      const links = [g.guide.fr, g.guide.en, g.guide.de, g.ipv6.source, g.sharedIpv4.source].filter((u): u is string => u !== null);
      for (const url of links) expect(new URL(url).protocol, `${g.id} ${url}`).toBe("https:");
    }
  });

  it("un opérateur non vérifié ne montre ni lien ni chemin", () => {
    const sfr = routerGuide("sfr");
    expect(sfr?.verified).toBe(false);
    expect([sfr?.guide.fr, sfr?.guide.en, sfr?.guide.de]).toEqual([null, null, null]);
    expect(sfr?.menuPaths).toEqual([]);
  });

  it("un pas-à-pas a au moins une page ; un remède d'IPv4 partagée a sa source", () => {
    for (const g of ROUTER_GUIDES) {
      if (g.stepByStep) expect(g.guide.fr ?? g.guide.en ?? g.guide.de, g.id).not.toBeNull();
      if (g.sharedIpv4.remedy) expect(g.sharedIpv4.source, g.id).not.toBeNull();
    }
    expect(ROUTER_GUIDES_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("la page dans la langue de l'interface, sinon la première qui existe", () => {
    const sunrise = routerGuide("sunrise")!;
    expect(routerGuideUrl(sunrise, "en-US")).toContain("7846");
    expect(routerGuideUrl(sunrise, "fr")).toContain("7845");
    expect(routerGuideUrl(routerGuide("free")!, "en")).toBe("https://assistance.free.fr/articles/1395");
    expect(routerGuideUrl(routerGuide("sfr")!, "fr")).toBeNull();
    expect(routerGuide("inconnu")).toBeNull();
  });
});
