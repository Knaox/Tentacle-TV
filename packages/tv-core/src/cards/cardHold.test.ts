import { describe, expect, it } from "vitest";
import { holdPanelOf, rateTargetVariant, ratingClosesSheet, sheetShowsActions } from "./cardHold";

const poster = { kind: "media", variant: "poster" };
const landscape = { kind: "media", variant: "landscape" };

describe("l'appui maintenu d'une carte", () => {
  it("à l'accueil, ouvre le panneau d'une vignette sur les rangées d'épisodes", () => {
    expect(holdPanelOf({ surface: "homeRow", row: "resume" })).toEqual(landscape);
    expect(holdPanelOf({ surface: "homeRow", row: "nextUp" })).toEqual(landscape);
    expect(holdPanelOf({ surface: "homeRow", row: "watched" })).toEqual(landscape);
  });

  it("à l'accueil, ouvre celui d'une affiche sur Ma liste, Favoris et les derniers ajouts", () => {
    expect(holdPanelOf({ surface: "homeRow", row: "watchlist" })).toEqual(poster);
    expect(holdPanelOf({ surface: "homeRow", row: "favorites" })).toEqual(poster);
    expect(holdPanelOf({ surface: "homeRow", row: "library" })).toEqual(poster);
  });

  it("ouvre celui d'une recommandation sur une étagère de recommandations et dans Pour vous", () => {
    expect(holdPanelOf({ surface: "homeRow", row: "reco" })).toEqual({ kind: "reco" });
    expect(holdPanelOf({ surface: "forYou" })).toEqual({ kind: "reco" });
  });

  it("sur un bouton du héros, ouvre le panneau dans la forme de sa source", () => {
    expect(holdPanelOf({ surface: "hero", fromResume: true })).toEqual(landscape);
    expect(holdPanelOf({ surface: "hero", fromResume: false })).toEqual(poster);
  });

  it("dans la recherche : la vignette d'un épisode, la série de la bibliothèque à compléter, le titre absent", () => {
    expect(holdPanelOf({ surface: "search", card: "episode" })).toEqual(landscape);
    expect(holdPanelOf({ surface: "search", card: "title" })).toEqual(poster);
    expect(holdPanelOf({ surface: "search", card: "librarySeries" })).toEqual(poster);
    expect(holdPanelOf({ surface: "search", card: "absentTitle" })).toEqual({ kind: "absent" });
  });

  it("dans la fiche : l'épisode en vignette, les volets et les similaires en affiche", () => {
    expect(holdPanelOf({ surface: "detail", card: "episode" })).toEqual(landscape);
    expect(holdPanelOf({ surface: "detail", card: "sagaPresent" })).toEqual(poster);
    expect(holdPanelOf({ surface: "detail", card: "similar" })).toEqual(poster);
    expect(holdPanelOf({ surface: "detail", card: "collection" })).toEqual(poster);
  });

  it("sur un volet absent, n'ouvre rien quand il ne se demande pas", () => {
    expect(holdPanelOf({ surface: "detail", card: "sagaAbsent", requestable: true })).toEqual({ kind: "absent" });
    expect(holdPanelOf({ surface: "detail", card: "sagaAbsent", requestable: false })).toBeNull();
    expect(holdPanelOf({ surface: "detail", card: "sagaAbsent" })).toBeNull();
  });

  it("dans une grille, ouvre le panneau de l'affiche", () => {
    expect(holdPanelOf({ surface: "grid" })).toEqual(poster);
  });
});

describe("« Noter » de la fiche", () => {
  it("note l'épisode lui-même, la série ou le film par l'affiche", () => {
    expect(rateTargetVariant("Episode")).toBe("landscape");
    expect(rateTargetVariant("Series")).toBe("poster");
    expect(rateTargetVariant("Movie")).toBe("poster");
    expect(rateTargetVariant("BoxSet")).toBe("poster");
  });
});

describe("le panneau réduit à la note", () => {
  it("n'a pas de pictos, et OK sur un cran le ferme", () => {
    expect(sheetShowsActions("rate")).toBe(false);
    expect(ratingClosesSheet("rate")).toBe(true);
  });

  it("le grand panneau garde ses pictos et reste ouvert quand on note", () => {
    expect(sheetShowsActions("actions")).toBe(true);
    expect(ratingClosesSheet("actions")).toBe(false);
  });
});
