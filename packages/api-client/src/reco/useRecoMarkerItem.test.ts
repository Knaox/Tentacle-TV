import { describe, expect, it } from "vitest";
import { resolveCardMarkers } from "@tentacle-tv/shared";
import type { UserRatingEntry } from "../hooks/useRatings";
import { userScoreFromRatings } from "../hooks/useCardMarkers";
import { seriesStateId } from "../hooks/useSeriesListMembership";
import { recoMarkerItem } from "./useRecoMarkerItem";

function rating(partial: Partial<UserRatingEntry>): UserRatingEntry {
  return {
    id: "r", mediaType: "movie", tmdbId: 1, jellyfinItemId: null, seasonNumber: 0, episodeNumber: 0,
    score: 7, syncStatus: "synced", updatedAt: "2026-09-28T00:00:00Z", ...partial,
  };
}

const base = { key: "tv:1399", mediaType: "tv" as const, tmdbId: 1399, title: "Arcane" };

describe("recoMarkerItem", () => {
  it("une série en bibliothèque répond par son item Jellyfin (Sets de Ma liste et des favoris)", () => {
    const face = recoMarkerItem({ ...base, jellyfinItemId: "s42" });
    expect(face.Type).toBe("Series");
    expect(seriesStateId(face)).toBe("s42");
  });

  it("retrouve la note posée depuis la carte par son tmdb, même hors bibliothèque", () => {
    const face = recoMarkerItem({ ...base, jellyfinItemId: null });
    expect(userScoreFromRatings([rating({ mediaType: "series", tmdbId: 1399, score: 9 })], face)).toBe(9);
    expect(face.Id.startsWith("reco:")).toBe(true);
  });

  it("n'invente aucun état : sans fiche en cache, un film n'est ni vu, ni aimé, ni dans Ma liste", () => {
    const face = recoMarkerItem({ ...base, key: "movie:603", mediaType: "movie", tmdbId: 603, jellyfinItemId: "m1" });
    expect(face.Type).toBe("Movie");
    expect(resolveCardMarkers({ item: face, communityRating: 7.4 }).statuses).toEqual([]);
  });
});
