import { describe, expect, it } from "vitest";
import { buildSuggestions, matchesDraft, moveActive, SUGGESTIONS_MAX } from "./suggestionModel";
import { searchTokens } from "@tentacle-tv/shared";

describe("suggestions de la barre (Octave)", () => {
  it("barre vide : aucune liste (les récentes sont dans la page, rien ne recouvre son titre)", () => {
    expect(buildSuggestions({ draft: "", recents: ["radiohead", "thunderstruck"], library: [{ kind: "artist", title: "Queen", subtitle: null }], extension: [] })).toEqual([]);
    expect(buildSuggestions({ draft: "   ", recents: ["radiohead"], library: [], extension: [] })).toEqual([]);
  });

  it("pendant la frappe, les récentes qui commencent comme elle restent en tête", () => {
    const out = buildSuggestions({ draft: "ra", recents: ["radiohead", "queen", "rammstein"], library: [], extension: [] });
    expect(out.map((s) => [s.kind, s.text])).toEqual([["recent", "radiohead"], ["recent", "rammstein"]]);
  });

  it("la frappe filtre par début de mot, accents et casse confondus", () => {
    expect(matchesDraft(searchTokens("tame im"), "Tame Impala")).toBe(true);
    expect(matchesDraft(searchTokens("mane"), "Måneskin")).toBe(true);
    expect(matchesDraft(searchTokens("pala"), "Tame Impala")).toBe(false);
  });

  it("récentes, puis artistes, titres, albums ; la bibliothèque avant l'extension ; un même texte cherché une fois", () => {
    const out = buildSuggestions({
      draft: "imag",
      recents: ["imagine dragons thunder", "queen"],
      library: [
        { kind: "track", title: "Radioactive", subtitle: "Imagine Dragons" },
        { kind: "artist", title: "Imagine Dragons", subtitle: null },
      ],
      extension: [
        { kind: "artist", title: "Imagine Dragons", subtitle: null },
        { kind: "track", title: "Imagine", subtitle: "John Lennon" },
        // Même recherche que le titre du même nom : pas de seconde ligne.
        { kind: "album", title: "Imagine", subtitle: "John Lennon" },
        { kind: "album", title: "Night Visions", subtitle: "Imagine Dragons" },
      ],
    });
    expect(out.map((s) => [s.kind, s.text])).toEqual([
      ["recent", "imagine dragons thunder"],
      ["artist", "Imagine Dragons"],
      ["track", "Radioactive Imagine Dragons"],
      ["track", "Imagine John Lennon"],
      ["album", "Night Visions Imagine Dragons"],
    ]);
  });

  it("jamais plus que le maximum, et des identifiants stables d'une frappe à l'autre", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ kind: "track" as const, title: `Song ${i}`, subtitle: "Band" }));
    const a = buildSuggestions({ draft: "so", recents: [], library: many, extension: [] });
    const b = buildSuggestions({ draft: "son", recents: [], library: many, extension: [] });
    expect(a.length).toBeLessThanOrEqual(SUGGESTIONS_MAX);
    expect(a[0].id).toBe(b[0].id);
  });

  it("les flèches vont de la saisie au dernier et reviennent à la saisie", () => {
    expect(moveActive(-1, 3, 1)).toBe(0);
    expect(moveActive(2, 3, 1)).toBe(-1);
    expect(moveActive(-1, 3, -1)).toBe(2);
    expect(moveActive(0, 3, -1)).toBe(-1);
    expect(moveActive(-1, 0, 1)).toBe(-1);
  });
});
