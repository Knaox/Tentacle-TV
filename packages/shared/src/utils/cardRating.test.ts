/**
 * L'invariant tenu ici : une carte qui montre l'affiche et le titre d'une
 * SÉRIE en montre la note, qu'elle porte un épisode isolé ou un lot « +N ».
 * Et l'inverse : une carte qui se nomme elle-même — vignette d'épisode,
 * résultat de recherche — garde SA note et ne déclenche aucune requête.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import { cardRatingFor, missingSeriesRatingIds } from "./cardRating";

function item(partial: Partial<MediaItem>): MediaItem {
  return { Id: "id", Name: "Titre", Type: "Movie", ...partial } as MediaItem;
}

/** La tuile que `groupLatestByRuns` fabrique pour un lot : l'identifiant de la
 *  série, le type d'une série, et rien d'autre — surtout pas de note. */
const lot = item({ Id: "serie-1", Type: "Series", Name: "Une série" });

describe("cardRatingFor", () => {
  it("un film rend sa note, sans rien réclamer", () => {
    expect(cardRatingFor(item({ CommunityRating: 7.4 }))).toEqual({
      rating: 7.4,
      missingSeriesId: null,
    });
  });

  it("une série déjà notée rend sa note, sans rien réclamer", () => {
    const r = cardRatingFor(item({ Id: "s1", Type: "Series", CommunityRating: 8.1 }));
    expect(r).toEqual({ rating: 8.1, missingSeriesId: null });
  });

  it("une tuile de lot réclame la note de sa série", () => {
    expect(cardRatingFor(lot)).toEqual({ rating: null, missingSeriesId: "serie-1" });
  });

  it("la même tuile, la carte des notes fournie, rend celle de la série", () => {
    const r = cardRatingFor(lot, "series", new Map([["serie-1", 8.6]]));
    expect(r).toEqual({ rating: 8.6, missingSeriesId: null });
  });

  it("un épisode en portée série IGNORE sa propre note et réclame celle de la série", () => {
    // Le cœur de la règle. La carte montre l'affiche et le titre de la série ;
    // rendre 9,9 ici ferait afficher deux notes différentes à deux épisodes
    // voisins de la même œuvre.
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "serie-2", CommunityRating: 9.9 });
    expect(cardRatingFor(ep, "series")).toEqual({ rating: null, missingSeriesId: "serie-2" });
    expect(cardRatingFor(ep, "series", new Map([["serie-2", 8.2]]))).toEqual({
      rating: 8.2,
      missingSeriesId: null,
    });
  });

  it("un épisode en portée item garde SA note et ne réclame rien", () => {
    const ep = item({ Id: "e1", Type: "Episode", SeriesId: "serie-2", CommunityRating: 9.9 });
    expect(cardRatingFor(ep, "item")).toEqual({ rating: 9.9, missingSeriesId: null });
  });

  it("un épisode sans série ne réclame rien", () => {
    const orphelin = item({ Id: "e2", Type: "Episode" });
    expect(cardRatingFor(orphelin, "series")).toEqual({ rating: null, missingSeriesId: null });
  });

  it("une note nulle vaut absence, et ne déclenche aucune résolution", () => {
    expect(cardRatingFor(item({ CommunityRating: 0 }))).toEqual({
      rating: null,
      missingSeriesId: null,
    });
  });

  it("un coffret sans note ne réclame rien", () => {
    expect(cardRatingFor(item({ Type: "BoxSet" }))).toEqual({ rating: null, missingSeriesId: null });
  });

  it("une saison suit sa série", () => {
    const saison = item({ Id: "sa1", Type: "Season", SeriesId: "serie-3" });
    expect(cardRatingFor(saison, "series").missingSeriesId).toBe("serie-3");
    expect(cardRatingFor(saison, "item").missingSeriesId).toBe(null);
  });

  it("une série déjà notée n'est pas réclamée, lot ou pas", () => {
    const vraie = item({ Id: "s5", Type: "Series", CommunityRating: 7.7 });
    expect(cardRatingFor(vraie, "series", new Map([["s5", 1.1]]))).toEqual({
      rating: 7.7,
      missingSeriesId: null,
    });
  });
});

describe("missingSeriesRatingIds", () => {
  it("dédoublonne trois épisodes d'une même série en un seul identifiant", () => {
    const items = [
      item({ Id: "e1", Type: "Episode", SeriesId: "s9" }),
      item({ Id: "e2", Type: "Episode", SeriesId: "s9" }),
      item({ Id: "e3", Type: "Episode", SeriesId: "s9" }),
    ];
    expect(missingSeriesRatingIds(items)).toEqual(["s9"]);
  });

  it("ignore ce que les cartes portent déjà", () => {
    const items = [
      item({ Id: "s1", Type: "Series", CommunityRating: 8 }),
      item({ Id: "m1", Type: "Movie", CommunityRating: 6 }),
    ];
    expect(missingSeriesRatingIds(items)).toEqual([]);
  });

  it("ignore les séries dont la note est déjà chargée", () => {
    const items = [lot, item({ Id: "s2", Type: "Series" })];
    expect(missingSeriesRatingIds(items, "series", new Map([["serie-1", 7]]))).toEqual(["s2"]);
  });

  it("garde l'ordre de première apparition — la clé de cache en dépend", () => {
    const items = [
      item({ Id: "b", Type: "Series" }),
      item({ Id: "a", Type: "Series" }),
      item({ Id: "b", Type: "Series" }),
    ];
    expect(missingSeriesRatingIds(items)).toEqual(["b", "a"]);
  });

  it("une liste vide ne demande rien", () => {
    expect(missingSeriesRatingIds([])).toEqual([]);
  });
});
