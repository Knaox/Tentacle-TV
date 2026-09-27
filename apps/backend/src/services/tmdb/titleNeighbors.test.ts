import { describe, expect, it } from "vitest";
import { neighborsOf, slimRecommendations } from "./titleNeighbors";

describe("voisins collaboratifs TMDB", () => {
  it("le bloc stocké ne garde que les ids et le type, dans l'ordre TMDB, vingt au plus", () => {
    const raw = {
      results: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        media_type: "movie",
        title: `T${i}`,
        overview: "long texte",
        poster_path: "/p.jpg",
      })),
    };
    const slim = slimRecommendations(raw, "movie");
    expect(slim.results).toHaveLength(20);
    expect(slim.results?.[0]).toEqual({ id: 1, media_type: "movie" });
    expect(JSON.stringify(slim)).not.toContain("overview");
  });

  it("sans media_type, le type du titre source ; un type inconnu (personne) est écarté", () => {
    const slim = slimRecommendations({ results: [{ id: 1 }, { id: 2, media_type: "person" }, { id: 3, media_type: "tv" }] }, "movie");
    expect(slim.results).toEqual([
      { id: 1, media_type: "movie" },
      { id: 3, media_type: "tv" },
    ]);
  });

  it("une ligne d'avant la clé rend null (inconnu), une liste vide rend []", () => {
    expect(neighborsOf(undefined, "tv")).toBeNull();
    expect(neighborsOf({ results: [] }, "tv")).toEqual([]);
    expect(neighborsOf({ results: [{ id: 7, media_type: "tv" }] }, "movie")).toEqual([{ mediaType: "tv", tmdbId: 7 }]);
  });
});
