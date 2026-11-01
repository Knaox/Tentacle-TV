import { describe, expect, it, vi } from "vitest";

const table = <T>(rows: T[]) => ({ findMany: async () => rows });
vi.mock("../../db", () => ({
  getPrisma: () => ({
    userRating: table([{ mediaType: "series", tmdbId: 1 }]),
    recommendationFeedback: table([{ itemKey: "movie:2" }]),
    userLike: table([{ mediaType: "movie", tmdbId: 3 }]),
    userSwipe: table([{ mediaType: "tv", tmdbId: 4 }]),
    // Une carte Vigie mise dans Ma liste, un cœur d'Affiner qui attend son titre.
    watchlistPending: table([{ mediaType: "movie", tmdbId: 5 }, { mediaType: "tv", tmdbId: 6 }]),
  }),
}));

import { abandonedKeys, accountExclusionKeys, canonicalKey, libraryExclusionKeys } from "./exclusions";
import { isInProgress } from "./libraryIndex";

const entry = (key: string, over: Partial<{ played: boolean; isFavorite: boolean; inWatchlist: boolean; inProgress: boolean }> = {}) => ({
  key,
  played: false,
  isFavorite: false,
  inWatchlist: false,
  inProgress: false,
  ...over,
});

describe("exclusions de bibliothèque", () => {
  it("vu, favori, Ma liste ou série entamée : jamais proposé ; le reste passe", () => {
    const keys = libraryExclusionKeys([
      entry("movie:1", { played: true }),
      entry("movie:2", { isFavorite: true }),
      entry("movie:3", { inWatchlist: true }),
      entry("tv:4", { inProgress: true }),
      entry("movie:5"),
    ]);
    expect(keys).toEqual(["movie:1", "movie:2", "movie:3", "tv:4"]);
  });

  it("les exclusions du compte : notes, refus, likes, verdicts, et ce qui est mis de côté", async () => {
    expect(await accountExclusionKeys("u1")).toEqual(["tv:1", "movie:2", "movie:3", "tv:4", "movie:5", "tv:6"]);
  });

  it("la clé canonique d'un like ou d'une note de série est tv:", () => {
    expect(canonicalKey("series", 7)).toBe("tv:7");
    expect(canonicalKey("movie", 7)).toBe("movie:7");
  });
});

describe("titres entamés et abandonnés", () => {
  it("un film commencé est entamé ; ouvert par erreur (< 1 %) ou vu, non", () => {
    expect(isInProgress("movie", false, 12, undefined, undefined)).toBe(true);
    expect(isInProgress("movie", false, 0.4, undefined, undefined)).toBe(false);
    expect(isInProgress("movie", true, 50, undefined, undefined)).toBe(false);
    expect(isInProgress("movie", false, undefined, undefined, undefined)).toBe(false);
  });

  it("une série entamée le reste, par pourcentage ou par épisodes vus", () => {
    expect(isInProgress("tv", false, 3, undefined, undefined)).toBe(true);
    expect(isInProgress("tv", false, 0, 8, 10)).toBe(true);
    expect(isInProgress("tv", false, 0, 10, 10)).toBe(false);
  });

  it("un film entamé sort des rangées comme un vu", () => {
    const keys = libraryExclusionKeys([entry("movie:7", { inProgress: true }), entry("movie:8")]);
    expect(keys).toEqual(["movie:7"]);
  });

  it("les ancres d'abandon excluent leur propre titre, pas les autres", () => {
    const keys = abandonedKeys([
      { key: "movie:10", kinds: ["abandon"] },
      { key: "tv:11", kinds: ["series", "abandon"] },
      { key: "movie:12", kinds: ["completed"] },
      { key: "jf:abc", kinds: ["abandon"] },
    ]);
    expect(keys).toEqual(["movie:10", "tv:11"]);
  });
});
