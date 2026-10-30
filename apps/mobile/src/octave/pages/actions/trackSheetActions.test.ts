import { describe, expect, it } from "vitest";
import { trackSheetActions, type TrackSheetFacts } from "./trackSheetActions";

/** Règle 15 du lot : une action soumise à un droit n'existe pas sans lui (ni bouton, ni entrée). */
const ALL: TrackSheetFacts = { hasPlayer: true, canAddToPlaylist: true, canLike: true, keep: "keep", albumTarget: "a1", artistTarget: "r1" };

describe("feuille d'un titre — sans le droit, l'action est absente", () => {
  it("tous les droits : l'ordre du menu « ⋯ » du bureau", () => {
    expect(trackSheetActions(ALL)).toEqual(["play", "playNext", "addToQueue", "addToPlaylist", "keep", "like", "goToAlbum", "goToArtist"]);
  });

  it("sans le droit d'ajout de Sillon (titre d'ailleurs) : ni « Ajouter à une playlist », ni cœur", () => {
    const shown = trackSheetActions({ ...ALL, canAddToPlaylist: false, canLike: false });
    expect(shown).not.toContain("addToPlaylist");
    expect(shown).not.toContain("like");
  });

  it("sans le droit hors ligne : pas de « Garder hors ligne » ; déjà gardé : le retrait seul reste", () => {
    expect(trackSheetActions({ ...ALL, keep: "none" })).not.toContain("keep");
    const kept = trackSheetActions({ ...ALL, keep: "remove" });
    expect(kept).toContain("removeKept");
    expect(kept).not.toContain("keep");
  });

  it("sans lecteur (écran hors coquille) : aucune action de lecture", () => {
    expect(trackSheetActions({ ...ALL, hasPlayer: false }).filter((a) => a === "play" || a === "playNext" || a === "addToQueue")).toEqual([]);
  });

  it("sans page où aller, ou déjà sur elle : pas de lien", () => {
    expect(trackSheetActions({ ...ALL, albumTarget: null, artistTarget: null })).not.toContain("goToAlbum");
    expect(trackSheetActions({ ...ALL, hide: { album: true, artist: true } })).not.toContain("goToArtist");
  });

  it("aucun droit, aucun lecteur, aucune page : la feuille est vide", () => {
    expect(trackSheetActions({ hasPlayer: false, canAddToPlaylist: false, canLike: false, keep: "none", albumTarget: null, artistTarget: null })).toEqual([]);
  });

  it("dans une playlist qui permet de retirer : « Retirer de la playlist » en tête, l'ajout (vers une autre) gardé", () => {
    const shown = trackSheetActions({ ...ALL, canRemoveFromPlaylist: true });
    expect(shown[0]).toBe("removeFromPlaylist");
    expect(shown).toContain("addToPlaylist");
    expect(trackSheetActions(ALL)).not.toContain("removeFromPlaylist");
  });
});
