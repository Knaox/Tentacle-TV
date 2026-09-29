import { describe, expect, it } from "vitest";
import {
  externalCardActionEntries,
  externalFavoriteLabelKey,
  externalWatchlistLabelKey,
  resolveExternalCardOverlay,
} from "./externalCardOverlay";

const direct = { mode: "direct" as const, label: "Demander", href: null };
const seasons = { mode: "open" as const, label: "Choisir les saisons", href: "/discover?request=tv:1399" };

describe("le survol d'une carte hors bibliothèque", () => {
  it("offre « Demander », la note, Ma liste et le cœur à l'arrivée", () => {
    expect(resolveExternalCardOverlay({ variant: "poster", request: direct, identified: true })).toEqual({
      variant: "poster", request: direct, open: "details", rate: true, watchlist: true, favorite: true, extras: [],
    });
  });

  it("ajoute « Ne plus me proposer » à une recommandation, et à elle seule", () => {
    expect(resolveExternalCardOverlay({ variant: "reco", request: null, identified: true }).extras).toEqual(["dismiss"]);
    expect(resolveExternalCardOverlay({ variant: "poster", request: null, identified: true }).extras).toEqual([]);
  });

  it("sans identité TMDB, ni note, ni Ma liste, ni cœur à l'arrivée", () => {
    const overlay = resolveExternalCardOverlay({ variant: "poster", request: direct, identified: false });
    expect(overlay.rate).toBe(false);
    expect(overlay.watchlist).toBe(false);
    expect(overlay.favorite).toBe(false);
  });

  it("un serveur qui ne sait pas aimer un titre absent : pas de cœur, le reste demeure", () => {
    const overlay = resolveExternalCardOverlay({ variant: "reco", request: seasons, identified: true, likes: false });
    expect(overlay.favorite).toBe(false);
    expect(externalCardActionEntries(overlay, { watchlist: false, favorite: false }).map((e) => e.kind))
      .toEqual(["request", "watchlist", "dismiss"]);
  });

  it("range le plateau comme la feuille et la pastille : la demande, Ma liste, le cœur, puis le refus", () => {
    const overlay = resolveExternalCardOverlay({ variant: "reco", request: seasons, identified: true });
    expect(externalCardActionEntries(overlay, { watchlist: true, favorite: false })).toEqual([
      { kind: "request", label: "Choisir les saisons" },
      { kind: "watchlist", labelKey: "removeFromWatchlistOnArrival", active: true },
      { kind: "favorite", labelKey: "addToFavoritesOnArrival", active: false },
      { kind: "dismiss", labelKey: "dismiss" },
    ]);
    expect(externalWatchlistLabelKey(false)).toBe("addToWatchlistOnArrival");
    expect(externalFavoriteLabelKey(true)).toBe("removeFromFavoritesOnArrival");
  });

  it("jamais plus de quatre boutons : la règle des cinq au plus sur une affiche tient", () => {
    const overlay = resolveExternalCardOverlay({ variant: "reco", request: direct, identified: true });
    expect(externalCardActionEntries(overlay, { watchlist: true, favorite: true })).toHaveLength(4);
  });
});
