import { describe, expect, it } from "vitest";
import { externalCardActionEntries, externalWatchlistLabelKey, resolveExternalCardOverlay } from "./externalCardOverlay";

const direct = { mode: "direct" as const, label: "Demander", href: null };

describe("le survol d'une carte hors bibliothèque", () => {
  it("offre « Demander », la note et Ma liste à l'arrivée", () => {
    expect(resolveExternalCardOverlay({ variant: "poster", request: direct, identified: true })).toEqual({
      variant: "poster", request: direct, open: "details", rate: true, watchlist: true, extras: [],
    });
  });

  it("ajoute « Ne plus me proposer » à une recommandation, et à elle seule", () => {
    expect(resolveExternalCardOverlay({ variant: "reco", request: null, identified: true }).extras).toEqual(["dismiss"]);
    expect(resolveExternalCardOverlay({ variant: "poster", request: null, identified: true }).extras).toEqual([]);
  });

  it("sans identité TMDB, ni note ni Ma liste à l'arrivée", () => {
    const overlay = resolveExternalCardOverlay({ variant: "poster", request: direct, identified: false });
    expect(overlay.rate).toBe(false);
    expect(overlay.watchlist).toBe(false);
  });

  it("range le plateau comme la feuille : la demande en tête, la bascule (libellé selon l'état), puis le refus", () => {
    const overlay = resolveExternalCardOverlay({ variant: "reco", request: direct, identified: true });
    expect(externalCardActionEntries(overlay, { watchlist: true })).toEqual([
      { kind: "request", label: "Demander" },
      { kind: "watchlist", labelKey: "removeFromWatchlistOnArrival", active: true },
      { kind: "dismiss", labelKey: "dismiss" },
    ]);
    expect(externalWatchlistLabelKey(false)).toBe("addToWatchlistOnArrival");
  });
});
