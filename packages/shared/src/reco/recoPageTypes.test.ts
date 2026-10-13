import { describe, expect, it } from "vitest";
import { RECO_CREDIT_ROLES, RECO_THEME_TAGS, RECO_WHY_KINDS, isRecoWhy } from "./recoPageTypes";
import type { RecoPage, RecoWhy } from "./recoPageTypes";

describe("contrat de la page « Pour vous »", () => {
  it("reconnaît chaque raison du contrat", () => {
    const samples: RecoWhy[] = [
      { kind: "similarTo", titles: [{ key: "tv:1920", title: "Twin Peaks" }], signal: "loved" },
      { kind: "person", person: { id: 137427, name: "Denis Villeneuve" }, role: "director" },
      { kind: "theme", theme: { key: "kw:1", label: "twist ending", tag: "twist" } },
      { kind: "company", company: { id: 49, name: "HBO", kind: "network" } },
      { kind: "collection", collection: { id: 726871, name: "Dune - Saga" } },
      { kind: "origin", language: "ko", country: "KR" },
      { kind: "genre", genre: { id: 53, name: "Thriller" } },
      { kind: "hiddenGem", rating: 8.4, votes: 900 },
      { kind: "acclaimed", rating: 8.7 },
      { kind: "recent", year: 2026 },
      { kind: "kindredViewers" },
      { kind: "exploration" },
    ];
    expect(samples.map((s) => s.kind)).toEqual([...RECO_WHY_KINDS]);
    for (const sample of samples) expect(isRecoWhy(sample)).toBe(true);
  });

  it("ignore une raison inconnue (serveur plus récent) ou malformée", () => {
    expect(isRecoWhy({ kind: "somethingNew" })).toBe(false);
    expect(isRecoWhy({})).toBe(false);
    expect(isRecoWhy(null)).toBe(false);
    expect(isRecoWhy("theme")).toBe(false);
  });

  it("garde des listes fermées sans doublon", () => {
    for (const list of [RECO_WHY_KINDS, RECO_THEME_TAGS, RECO_CREDIT_ROLES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("une page d'avant les raisons reste une page valide (tout ajout est optionnel)", () => {
    const legacy: RecoPage = {
      state: "ready",
      signalCount: 42,
      generating: false,
      refining: false,
      exploring: false,
      generatedAt: null,
      poolGeneratedAt: null,
      tmdbConfigured: true,
      personalized: true,
      filter: null,
      rows: [{ key: "forYou", items: [] }],
    };
    expect(legacy.featured).toBeUndefined();
    expect(legacy.rows[0].why).toBeUndefined();
  });
});
