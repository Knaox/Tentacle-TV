import { describe, expect, it } from "vitest";
import { resolveCardOverlay, type CardOverlayVariant, type CardToggleStates } from "@tentacle-tv/shared";
import { sheetActionEntries } from "./sheetActions";

const NONE: CardToggleStates = { watchlist: false, favorite: false, watched: false };

function overlayOf(variant: CardOverlayVariant, inLibrary = true, playable = true) {
  return resolveCardOverlay({ variant, inLibrary, playable, rateable: true, offline: false });
}

const kinds = (variant: CardOverlayVariant, extra: { inLibrary?: boolean; playable?: boolean; providerFilterActive?: boolean } = {}) =>
  sheetActionEntries({
    overlay: overlayOf(variant, extra.inLibrary ?? true, extra.playable ?? true),
    states: NONE,
    inLibrary: extra.inLibrary ?? true,
    providerFilterActive: extra.providerFilterActive,
  }).map((entry) => entry.kind);

describe("les pictos du grand panneau", () => {
  it("affiche : la lecture, Ma liste → favori → vu, puis « Plus d'infos » au bout", () => {
    expect(kinds("poster")).toEqual(["play", "watchlist", "favorite", "watched", "details"]);
  });

  it("vignette : « Plus d'infos » vient du modèle partagé, une seule fois", () => {
    expect(kinds("landscape")).toEqual(["play", "watchlist", "favorite", "watched", "details"]);
  });

  it("reco en bibliothèque : « Plus d'infos » AVANT « Ne plus me proposer »", () => {
    expect(kinds("reco")).toEqual(["play", "watchlist", "favorite", "watched", "details", "dismiss"]);
  });

  it("sous un filtre de plateformes, « Toutes les plateformes » au bout — d'une reco seulement", () => {
    expect(kinds("reco", { providerFilterActive: true })).toEqual(["play", "watchlist", "favorite", "watched", "details", "dismiss", "providersAll"]);
    expect(kinds("poster", { providerFilterActive: true })).toEqual(["play", "watchlist", "favorite", "watched", "details"]);
  });

  it("hors bibliothèque : ni bascules ni fiche, le refus seul", () => {
    expect(kinds("reco", { inLibrary: false })).toEqual(["dismiss"]);
  });

  it("rien à lire : pas de lecture, la fiche reste", () => {
    expect(kinds("poster", { playable: false })).toEqual(["watchlist", "favorite", "watched", "details"]);
  });

  it("dit d'où vient chaque picto : le modèle partagé ou le salon", () => {
    const origins = sheetActionEntries({ overlay: overlayOf("reco"), states: NONE, inLibrary: true, providerFilterActive: true }).map((e) => `${e.kind}:${e.origin}`);
    expect(origins).toEqual(["play:model", "watchlist:model", "favorite:model", "watched:model", "details:salon", "dismiss:model", "providersAll:salon"]);
    expect(sheetActionEntries({ overlay: overlayOf("landscape"), states: NONE, inLibrary: true }).find((e) => e.kind === "details")?.origin).toBe("model");
  });

  it("dit l'état des bascules et le geste qu'elles feront", () => {
    const entries = sheetActionEntries({
      overlay: overlayOf("poster"),
      states: { watchlist: true, favorite: false, watched: false },
      inLibrary: true,
    });
    expect(entries[1]).toEqual({ kind: "watchlist", labelKey: "cards:removeFromWatchlist", active: true, origin: "model" });
    expect(entries[2]).toEqual({ kind: "favorite", labelKey: "cards:addToFavorites", active: false, origin: "model" });
    expect(entries[4]).toEqual({ kind: "details", labelKey: "cards:moreInfo", origin: "salon" });
  });
});
