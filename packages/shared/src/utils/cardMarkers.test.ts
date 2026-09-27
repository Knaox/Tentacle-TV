import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import {
  cardMarkerLabelParts,
  isEmptyCardMarkers,
  resolveCardMarkers,
} from "./cardMarkers";

function item(userData?: Partial<NonNullable<MediaItem["UserData"]>>, type = "Movie"): MediaItem {
  return {
    Id: "x",
    Name: "Titre",
    Type: type,
    UserData: userData ? { IsFavorite: false, Played: false, ...userData } : undefined,
  } as MediaItem;
}

describe("resolveCardMarkers", () => {
  it("rend une carte vide quand rien n'est connu", () => {
    const markers = resolveCardMarkers({ item: item(), communityRating: null });
    expect(markers).toEqual({ communityRating: null, userScore: null, statuses: [] });
    expect(isEmptyCardMarkers(markers)).toBe(true);
  });

  it("lit les états d'un film sur son UserData, dans l'ordre d'affichage", () => {
    const markers = resolveCardMarkers({
      item: item({ Played: true, IsFavorite: true, Likes: true }),
      communityRating: 7.4,
    });
    expect(markers.statuses).toEqual(["watchlist", "favorite", "watched"]);
    expect(markers.communityRating).toBe(7.4);
  });

  it("préfère l'appartenance de la série au UserData de l'épisode", () => {
    const markers = resolveCardMarkers({
      item: item({ Likes: true, IsFavorite: true }, "Episode"),
      communityRating: null,
      inWatchlist: false,
      isFavorite: false,
    });
    expect(markers.statuses).toEqual([]);
  });

  it("n'accepte qu'une note utilisateur entre 1 et 10", () => {
    expect(resolveCardMarkers({ item: item(), communityRating: null, userScore: 0 }).userScore).toBeNull();
    expect(resolveCardMarkers({ item: item(), communityRating: null, userScore: 11 }).userScore).toBeNull();
    expect(resolveCardMarkers({ item: item(), communityRating: null, userScore: 7 }).userScore).toBe(7);
  });

  it("ignore une note globale nulle ou négative (Jellyfin rend 0 pour « aucune »)", () => {
    expect(resolveCardMarkers({ item: item(), communityRating: 0 }).communityRating).toBeNull();
  });

  it("n'affiche pas de coche pour un titre seulement entamé", () => {
    const markers = resolveCardMarkers({ item: item({ PlayedPercentage: 40 }), communityRating: null });
    expect(markers.statuses).toEqual([]);
  });
});

describe("cardMarkerLabelParts", () => {
  it("compose le libellé dans l'ordre visuel", () => {
    const markers = resolveCardMarkers({
      item: item({ Played: true, Likes: true }),
      communityRating: 8.26,
      userScore: 9,
    });
    expect(cardMarkerLabelParts(markers)).toEqual([
      { key: "communityRating", params: { score: "8.3" } },
      { key: "userRating", params: { score: "9" } },
      { key: "status.watchlist" },
      { key: "status.watched" },
    ]);
  });
});
