import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardFaceNeedsDetail } from "./useCardFace";

const item = (Type: string, ProviderIds?: Record<string, string>) => ({ Id: "x", Name: "x", Type, ProviderIds }) as MediaItem;

describe("cardFaceNeedsDetail", () => {
  it("demande la fiche d'un film ou d'une série arrivés sans ProviderIds (recherche, similaires)", () => {
    expect(cardFaceNeedsDetail(item("Movie"))).toBe(true);
    expect(cardFaceNeedsDetail(item("Series"))).toBe(true);
  });

  it("s'en passe quand la carte porte déjà ses identifiants", () => {
    expect(cardFaceNeedsDetail(item("Movie", { Tmdb: "603" }))).toBe(false);
    expect(cardFaceNeedsDetail(item("Series", { Imdb: "tt1" }))).toBe(false);
  });

  it("ne la demande jamais pour un épisode ni une collection", () => {
    expect(cardFaceNeedsDetail(item("Episode"))).toBe(false);
    expect(cardFaceNeedsDetail(item("BoxSet"))).toBe(false);
  });
});
