import { describe, expect, it } from "vitest";
import type { SharedListItem } from "@tentacle-tv/api-client";
import { sharedPosterUrl, summarizeSharedList } from "./shareSummary";

const item = (over: Partial<SharedListItem>): SharedListItem => ({ Id: "a", Name: "A", Type: "Movie", ...over });

describe("summarizeSharedList", () => {
  it("compte films, séries et titres hors du serveur", () => {
    const s = summarizeSharedList([
      item({ Id: "1" }),
      item({ Id: "2", Type: "Series" }),
      item({ Id: "", Type: "Series", PosterUrl: "https://x/p.jpg" }),
    ]);
    expect(s).toEqual({ total: 3, movies: 1, series: 2, offServer: 1, selectable: ["1", "2"] });
  });

  it("rend un bilan nul pour une liste vide", () => {
    expect(summarizeSharedList([])).toEqual({ total: 0, movies: 0, series: 0, offServer: 0, selectable: [] });
  });
});

describe("sharedPosterUrl", () => {
  it("passe par le proxy public pour un titre du serveur, avec son tag", () => {
    expect(sharedPosterUrl(item({ Id: "42", ImageTags: { Primary: "t1" } })))
      .toBe("/api/jellyfin/Items/42/Images/Primary?fillHeight=450&quality=90&tag=t1");
  });

  it("prend l'affiche TMDB d'un titre hors du serveur, ou rien", () => {
    expect(sharedPosterUrl(item({ Id: "", PosterUrl: "https://tmdb/p.jpg" }))).toBe("https://tmdb/p.jpg");
    expect(sharedPosterUrl(item({ Id: "" }))).toBeNull();
  });
});
