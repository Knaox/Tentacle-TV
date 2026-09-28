import { describe, expect, it } from "vitest";
import { CARD_STATUS_ORDER } from "./cardMarkers";
import {
  CARD_TOGGLE_ORDER,
  cardActionEntries,
  cardExtraLabelKey,
  cardToggleLabelKey,
  resolveCardOverlay,
  type CardOverlayInput,
} from "./cardOverlay";

const LIBRARY: Omit<CardOverlayInput, "variant"> = { inLibrary: true, playable: true, rateable: true };
const NONE = { watchlist: false, favorite: false, watched: false } as const;

describe("resolveCardOverlay", () => {
  it("donne à l'affiche la lecture, la note et les trois bascules ; le clic ouvre la fiche", () => {
    const overlay = resolveCardOverlay({ variant: "poster", ...LIBRARY });
    expect(overlay).toEqual({
      variant: "poster",
      play: { labelKey: "play" },
      open: "details",
      rate: true,
      toggles: ["watchlist", "favorite", "watched"],
      extras: [],
    });
  });

  it("range les bascules dans l'ordre de la pastille d'états du repos", () => {
    expect(CARD_TOGGLE_ORDER).toEqual(CARD_STATUS_ORDER);
  });

  it("dit « Reprendre » quand une lecture est entamée", () => {
    expect(resolveCardOverlay({ variant: "poster", ...LIBRARY, resume: true }).play).toEqual({ labelKey: "resume" });
  });

  it("lance la lecture au clic d'une vignette 16:9, et lui donne un bouton de fiche", () => {
    const overlay = resolveCardOverlay({ variant: "landscape", ...LIBRARY, resume: true });
    expect(overlay.open).toBe("play");
    expect(overlay.extras).toEqual(["details"]);
  });

  it("ramène à la fiche une vignette qui n'a rien à lire", () => {
    const overlay = resolveCardOverlay({ variant: "landscape", ...LIBRARY, playable: false });
    expect(overlay.open).toBe("details");
    expect(overlay.play).toBeNull();
    expect(overlay.extras).toEqual([]);
  });

  it("ajoute « Ne plus me proposer » au bout du plateau d'une recommandation", () => {
    const overlay = resolveCardOverlay({ variant: "reco", ...LIBRARY, offline: true });
    expect(overlay.extras).toEqual(["offline", "dismiss"]);
    expect(overlay.toggles).toEqual(["watchlist", "favorite", "watched"]);
  });

  it("hors bibliothèque, ne garde que la note et le refus", () => {
    const overlay = resolveCardOverlay({ variant: "reco", inLibrary: false, playable: true, rateable: true, offline: true });
    expect(overlay.play).toBeNull();
    expect(overlay.toggles).toEqual([]);
    expect(overlay.extras).toEqual(["dismiss"]);
    expect(overlay.rate).toBe(true);
    expect(overlay.open).toBe("details");
  });

  it("ne propose pas d'étoiles à un titre sans identité de notation", () => {
    expect(resolveCardOverlay({ variant: "poster", ...LIBRARY, rateable: false }).rate).toBe(false);
  });

  it("réduit un titre lu sur le disque à la coche « vu », sans note ni hors ligne", () => {
    const poster = resolveCardOverlay({ variant: "poster", inLibrary: false, playable: true, rateable: true, offline: true, local: true });
    expect(poster.toggles).toEqual(["watched"]);
    expect(poster.rate).toBe(false);
    expect(poster.extras).toEqual([]);
    expect(poster.play).toEqual({ labelKey: "play" });
    expect(poster.open).toBe("details");
    const landscape = resolveCardOverlay({ variant: "landscape", ...LIBRARY, offline: true, local: true });
    expect(landscape.open).toBe("play");
    expect(landscape.extras).toEqual(["details"]);
  });

  it("met « garder hors ligne » avant la fiche, là où la plateforme le permet", () => {
    const overlay = resolveCardOverlay({ variant: "landscape", ...LIBRARY, offline: true });
    expect(overlay.extras).toEqual(["offline", "details"]);
  });
});

describe("libellés", () => {
  it("disent ce que fera le geste, selon l'état", () => {
    expect(cardToggleLabelKey("watchlist", false)).toBe("addToWatchlist");
    expect(cardToggleLabelKey("watchlist", true)).toBe("removeFromWatchlist");
    expect(cardToggleLabelKey("favorite", true)).toBe("removeFromFavorites");
    expect(cardToggleLabelKey("watched", false)).toBe("markWatched");
    expect(cardExtraLabelKey("dismiss")).toBe("dismiss");
    expect(cardExtraLabelKey("details")).toBe("moreInfo");
  });
});

describe("cardActionEntries", () => {
  it("présente lecture, bascules puis extras, avec leur état", () => {
    const overlay = resolveCardOverlay({ variant: "reco", ...LIBRARY, resume: true });
    const entries = cardActionEntries(overlay, { ...NONE, favorite: true });
    expect(entries.map((e) => e.kind)).toEqual(["play", "watchlist", "favorite", "watched", "dismiss"]);
    expect(entries[0]).toEqual({ kind: "play", labelKey: "resume" });
    expect(entries[2]).toEqual({ kind: "favorite", labelKey: "removeFromFavorites", active: true });
    expect(entries[1]?.active).toBe(false);
  });

  it("n'offre rien à basculer hors bibliothèque", () => {
    const overlay = resolveCardOverlay({ variant: "reco", inLibrary: false, playable: false, rateable: false });
    expect(cardActionEntries(overlay, NONE).map((e) => e.kind)).toEqual(["dismiss"]);
  });
});
