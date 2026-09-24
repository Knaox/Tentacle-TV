import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { firstReasonText, recoItemToMediaItem, recoLibraryItems } from "./recoMediaItem";

function reco(partial: Partial<RecoRowItem>): RecoRowItem {
  return {
    key: "movie:1", mediaType: "movie", tmdbId: 1, title: "Nébuleuse", year: 2018, posterPath: null,
    jellyfinItemId: "m1", source: "library", score: 1, voteAverage: 7.46, reasons: [], ...partial,
  };
}

describe("recommandations du téléviseur", () => {
  it("fait d'un titre en bibliothèque un titre Jellyfin", () => {
    expect(recoItemToMediaItem(reco({}))).toEqual({
      Id: "m1", Name: "Nébuleuse", Type: "Movie", ProductionYear: 2018, CommunityRating: 7.5,
    });
    expect(recoItemToMediaItem(reco({ mediaType: "tv", year: null, voteAverage: null }))).toEqual({
      Id: "m1", Name: "Nébuleuse", Type: "Series",
    });
  });

  it("écarte ce qui n'est pas sur le serveur, sans changer l'ordre du moteur", () => {
    const items = recoLibraryItems([
      reco({ jellyfinItemId: "a" }), reco({ jellyfinItemId: null }), reco({ jellyfinItemId: "b" }),
    ]);
    expect(items.map((item) => item.Id)).toEqual(["a", "b"]);
  });

  it("garde la première raison qui fait une phrase", () => {
    const toText = (reason: { kind: string }) => (reason.kind === "seed" ? "Parce que vous avez aimé X" : null);
    expect(firstReasonText([{ kind: "facet" }, { kind: "seed" }], toText)).toBe("Parce que vous avez aimé X");
    expect(firstReasonText([{ kind: "facet" }], toText)).toBeNull();
  });
});
