import { describe, expect, it } from "vitest";
import { libraryRescanErrorCode, metadataArrivalKeys } from "./useLibraryRescan";
import { TentacleApiError } from "./usePreferences";

/**
 * Ce qu'une analyse renouvelle sur la fiche, et la lecture d'un refus du
 * serveur — les deux moitiés de « Réanalyser maintenant » côté clients.
 */

describe("metadataArrivalKeys", () => {
  it("une série : sa fiche, ses saisons, ses épisodes et son état de visionnage", () => {
    expect(metadataArrivalKeys({ Id: "s", Type: "Series" })).toEqual([
      ["item", "s"], ["seasons", "s"], ["episodes", "s"], ["episode-sources", "s"], ["series-watch-state", "s"],
    ]);
  });

  it("un épisode : sa fiche, puis celle de sa série et ce qu'elle montre", () => {
    expect(metadataArrivalKeys({ Id: "e", Type: "Episode", SeriesId: "s" })).toEqual([
      ["item", "e"], ["item", "s"], ["seasons", "s"], ["episodes", "s"], ["episode-sources", "s"], ["series-watch-state", "s"],
    ]);
  });

  it("un film : sa fiche seule", () => {
    expect(metadataArrivalKeys({ Id: "m", Type: "Movie" })).toEqual([["item", "m"]]);
  });
});

describe("libraryRescanErrorCode", () => {
  it("lit le code du contrat dans le corps du refus", () => {
    expect(libraryRescanErrorCode(new TentacleApiError(JSON.stringify({ error: "not-found" }), 404))).toBe("not-found");
    expect(libraryRescanErrorCode(new TentacleApiError(JSON.stringify({ error: "busy" }), 409))).toBe("busy");
  });

  it("un corps hors contrat ou illisible vaut « failed », un réseau muet « unreachable »", () => {
    expect(libraryRescanErrorCode(new TentacleApiError(JSON.stringify({ error: "autre" }), 500))).toBe("failed");
    expect(libraryRescanErrorCode(new TentacleApiError("<html>", 502))).toBe("failed");
    expect(libraryRescanErrorCode(new TypeError("Failed to fetch"))).toBe("unreachable");
  });
});
