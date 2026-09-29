import { describe, expect, it } from "vitest";
import { tmdbMediaType } from "./useRemoteTrailers";

describe("tmdbMediaType", () => {
  it("un film et une série ont leur liste TMDB", () => {
    expect(tmdbMediaType("Movie")).toBe("movie");
    expect(tmdbMediaType("Series")).toBe("tv");
  });

  it("un épisode, non : son identifiant TMDB est celui de l'épisode, pas de la série", () => {
    expect(tmdbMediaType("Episode")).toBeUndefined();
    expect(tmdbMediaType("Season")).toBeUndefined();
    expect(tmdbMediaType(undefined)).toBeUndefined();
  });
});
