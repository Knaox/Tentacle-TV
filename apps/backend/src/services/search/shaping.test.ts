import { describe, expect, it } from "vitest";
import { item } from "../../../test/searchCatalog";
import { toMediaItem } from "./shaping";

/**
 * Un titre du catalogue devenu carte : son identité TMDB voyage avec lui —
 * c'est par elle qu'un client demande à une extension ce qui manque à une
 * série (`titles.gaps`) —, et rien n'est inventé quand l'index ne l'a pas.
 */

describe("toMediaItem", () => {
  it("porte l'identifiant TMDB du titre", () => {
    const series = toMediaItem(item({ name: "Breaking Bad", type: "Series", tmdbId: "1396" }), undefined);
    expect(series.ProviderIds).toEqual({ Tmdb: "1396" });
  });

  it("sans identifiant TMDB, pas de champ du tout", () => {
    const movie = toMediaItem(item({ name: "Un film sans fiche" }), undefined);
    expect(movie).not.toHaveProperty("ProviderIds");
  });
});
