import { describe, expect, it } from "vitest";
import type { TrailerEntry } from "../../../trailers/trailerCatalog";
import { previewCandidates } from "./previewCandidates";

const entry = (playback: TrailerEntry["playback"], version: TrailerEntry["version"] = "localized"): TrailerEntry => ({
  scope: { kind: "season", season: 6 }, playback, name: "x", version, type: "trailer", source: "tmdb",
});
const ALLOCINE = entry({ kind: "dailymotion", videoId: "x8abcde" });
const VOST = entry({ kind: "youtube", ytId: "vostTrail01" }, "subtitled");
const VO = entry({ kind: "youtube", ytId: "voTrailer01" }, "original");
const LOCAL = entry({ kind: "jellyfin", itemId: "0123456789abcdef0123456789abcdef" });

describe("candidates d'un aperçu (le catalogue)", () => {
  it("l'ordre du catalogue, avec le rang de langue de chacune ; AlloCiné pour un client qui lit Dailymotion", () => {
    expect(previewCandidates([LOCAL, ALLOCINE, VOST, VO], { dailymotion: true })).toEqual([
      { ref: "dm:x8abcde", youtube: false, langRank: 0 },
      { ref: "vostTrail01", youtube: true, langRank: 1 },
      { ref: "voTrailer01", youtube: true, langRank: 2 },
    ]);
  });

  it("un client d'avant : YouTube seulement ; jamais une locale (pas de flux relayé)", () => {
    expect(previewCandidates([LOCAL, ALLOCINE, VOST], { dailymotion: false }).map((c) => c.ref)).toEqual(["vostTrail01"]);
  });

  it("une vidéo une fois ; rien à proposer : une liste vide", () => {
    expect(previewCandidates([VOST, VOST], { dailymotion: true })).toHaveLength(1);
    expect(previewCandidates([], { dailymotion: true })).toEqual([]);
  });
});
