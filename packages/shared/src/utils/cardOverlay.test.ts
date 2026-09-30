import { describe, expect, it } from "vitest";
import { CARD_STATUS_ORDER } from "./cardMarkers";
import {
  CARD_TOGGLE_ORDER,
  cardActionEntries,
  cardTrayEntries,
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
      playInTray: true,
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

  it("ne met la lecture au plateau que là où le clic ne la lance pas", () => {
    expect(resolveCardOverlay({ variant: "poster", ...LIBRARY }).playInTray).toBe(true);
    expect(resolveCardOverlay({ variant: "reco", ...LIBRARY, resume: true }).playInTray).toBe(true);
    // La vignette EST la lecture : son plateau ne la répète pas…
    const landscape = resolveCardOverlay({ variant: "landscape", ...LIBRARY, resume: true });
    expect(landscape.playInTray).toBe(false);
    // … mais la feuille, qui remplace la carte, la garde en tête.
    expect(cardActionEntries(landscape, NONE)[0]).toEqual({ kind: "play", labelKey: "resume" });
    // Rien à lire, rien au plateau.
    expect(resolveCardOverlay({ variant: "poster", ...LIBRARY, playable: false }).playInTray).toBe(false);
    expect(resolveCardOverlay({ variant: "reco", inLibrary: false, playable: true, rateable: true }).playInTray).toBe(false);
  });

  it("ramène à la fiche une vignette qui n'a rien à lire", () => {
    const overlay = resolveCardOverlay({ variant: "landscape", ...LIBRARY, playable: false });
    expect(overlay.open).toBe("details");
    expect(overlay.play).toBeNull();
    expect(overlay.extras).toEqual([]);
  });

  it("ajoute « Ne plus me proposer » au bout du plateau d'une recommandation, sans hors ligne", () => {
    // Lire + trois bascules + refus : cinq boutons, le plafond d'une affiche
    // de 137 px qui tient l'espacement de WCAG 2.5.8.
    const overlay = resolveCardOverlay({ variant: "reco", ...LIBRARY, offline: true });
    expect(overlay.extras).toEqual(["dismiss"]);
    expect(overlay.toggles).toEqual(["watchlist", "favorite", "watched"]);
    expect(overlay.playInTray).toBe(true);
  });

  it("ne dépasse jamais cinq boutons au plateau d'une affiche", () => {
    for (const variant of ["poster", "reco"] as const) {
      const overlay = resolveCardOverlay({ variant, ...LIBRARY, offline: true });
      const count = (overlay.playInTray ? 1 : 0) + overlay.toggles.length + overlay.extras.length;
      expect(count).toBeLessThanOrEqual(5);
    }
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
    expect(poster.playInTray).toBe(true);
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

describe("cardTrayEntries", () => {
  it("met « Lire » en tête du plateau d'une affiche et d'une recommandation", () => {
    for (const variant of ["poster", "reco"] as const) {
      const overlay = resolveCardOverlay({ variant, ...LIBRARY, resume: true });
      expect(cardTrayEntries(overlay, NONE)[0]).toEqual({ kind: "play", labelKey: "resume" });
    }
  });

  it("ne répète pas au plateau d'une vignette 16:9 la lecture que son clic lance", () => {
    const overlay = resolveCardOverlay({ variant: "landscape", ...LIBRARY, resume: true });
    expect(cardTrayEntries(overlay, { ...NONE, watched: true }).map((e) => e.kind)).toEqual([
      "watchlist",
      "favorite",
      "watched",
      "details",
    ]);
    // La feuille, elle, la garde en tête : elle remplace la carte.
    expect(cardActionEntries(overlay, NONE)[0]?.kind).toBe("play");
  });

  it("garde l'état des bascules et l'ordre de la pastille", () => {
    const overlay = resolveCardOverlay({ variant: "poster", ...LIBRARY });
    const entries = cardTrayEntries(overlay, { watchlist: true, favorite: false, watched: true });
    expect(entries.map((e) => [e.kind, e.active])).toEqual([
      ["play", undefined],
      ["watchlist", true],
      ["favorite", false],
      ["watched", true],
    ]);
    expect(entries[1]?.labelKey).toBe("removeFromWatchlist");
  });

  it("ne dépasse jamais cinq boutons, sur aucune variante", () => {
    for (const variant of ["poster", "landscape", "reco"] as const) {
      const overlay = resolveCardOverlay({ variant, ...LIBRARY, offline: true });
      expect(cardTrayEntries(overlay, NONE).length).toBeLessThanOrEqual(5);
    }
  });
});
