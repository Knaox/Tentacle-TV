import { describe, expect, it } from "vitest";
import { deriveRegionDirectory, mergeWorldProviders } from "./providerMerge";

const WORLD = mergeWorldProviders([
  { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priorities: { FR: 5, CH: 0 } },
  { provider_id: 283, provider_name: "Crunchyroll", logo_path: "/c.jpg", display_priorities: { FR: 2, CH: 43 } },
  // Doublon film/série : le premier logo non vide gagne, la priorité la plus petite aussi.
  { provider_id: 8, provider_name: "Netflix", logo_path: "/n2.jpg", display_priorities: { FR: 7, US: 1 } },
  { provider_id: 415, provider_name: "Animation Digital Network", logo_path: null, display_priorities: { FR: 20 } },
  { provider_id: 415, provider_name: "Animation Digital Network", logo_path: "/adn.jpg", display_priorities: { FR: 20 } },
  { provider_id: 234, provider_name: "Arte", logo_path: "/arte.jpg", display_priorities: { FR: 10, CH: 51 } },
  { provider_id: 999, provider_name: "Hors famille, hors région", logo_path: "/x.jpg", display_priorities: { US: 3 } },
]);

describe("mergeWorldProviders", () => {
  it("dédoublonne par id, garde le premier logo non vide et la plus petite priorité", () => {
    const netflix = WORLD.find((p) => p.id === 8);
    expect(netflix?.logoPath).toBe("/n.jpg");
    expect(netflix?.priorities).toEqual({ FR: 5, CH: 0, US: 1 });
    expect(WORLD.find((p) => p.id === 415)?.logoPath).toBe("/adn.jpg");
    expect(WORLD.map((p) => p.id)).toEqual([8, 234, 283, 415, 999]);
  });
});

describe("deriveRegionDirectory", () => {
  const keep = new Set([415, 283]);

  it("en France : les plateformes à priorité FR, par priorité puis nom, logos région + familles", () => {
    const fr = deriveRegionDirectory(WORLD, "FR", keep);
    expect(fr.region).toBe("FR");
    expect(fr.providers.map((p) => p.id)).toEqual([283, 8, 234, 415]);
    expect(fr.logos).toEqual({ 283: "/c.jpg", 8: "/n.jpg", 234: "/arte.jpg", 415: "/adn.jpg" });
  });

  it("en Suisse : ADN hors région mais son logo reste (famille) ; 999 ignoré", () => {
    const ch = deriveRegionDirectory(WORLD, "CH", keep);
    expect(ch.providers.map((p) => p.id)).toEqual([8, 283, 234]);
    expect(ch.logos[415]).toBe("/adn.jpg");
    expect(ch.logos[999]).toBeUndefined();
  });

  it("à priorité égale, par nom", () => {
    const world = mergeWorldProviders([
      { provider_id: 2, provider_name: "Zed", display_priorities: { FR: 1 } },
      { provider_id: 1, provider_name: "Alpha", display_priorities: { FR: 1 } },
      { provider_id: 3, provider_name: "Beta", display_priorities: { FR: 0 } },
    ]);
    expect(deriveRegionDirectory(world, "FR", new Set()).providers.map((p) => p.name)).toEqual([
      "Beta",
      "Alpha",
      "Zed",
    ]);
  });
});
