import { describe, expect, it } from "vitest";
import { mergeProviders } from "./providerMerge";

describe("fusion de l'annuaire des plateformes", () => {
  it("dédoublonne par id, garde le premier logo non vide, trie par priorité de la région puis par nom", () => {
    const merged = mergeProviders(
      [
        { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priorities: { FR: 5, US: 0 }, display_priority: 0 },
        { provider_id: 283, provider_name: "Crunchyroll", logo_path: "/c.jpg", display_priorities: { FR: 2 } },
        { provider_id: 8, provider_name: "Netflix", logo_path: "/n2.jpg", display_priorities: { FR: 5 } },
        { provider_id: 415, provider_name: "ADN", logo_path: null, display_priority: 3 },
        { provider_id: 415, provider_name: "ADN", logo_path: "/adn.jpg", display_priority: 3 },
      ],
      "FR"
    );
    expect(merged.map((p) => p.id)).toEqual([283, 415, 8]);
    expect(merged.find((p) => p.id === 8)?.logoPath).toBe("/n.jpg");
    expect(merged.find((p) => p.id === 415)?.logoPath).toBe("/adn.jpg");
  });

  it("sans priorité connue : en fin, par nom", () => {
    const merged = mergeProviders(
      [
        { provider_id: 2, provider_name: "Zed" },
        { provider_id: 1, provider_name: "Alpha" },
        { provider_id: 3, provider_name: "Beta", display_priority: 1 },
      ],
      "FR"
    );
    expect(merged.map((p) => p.name)).toEqual(["Beta", "Alpha", "Zed"]);
  });
});
