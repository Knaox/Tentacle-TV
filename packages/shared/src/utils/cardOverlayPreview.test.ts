import { describe, expect, it } from "vitest";
import { cardActionEntries, resolveCardOverlay, type CardOverlayInput, type CardOverlayVariant } from "./cardOverlay";
import { externalCardActionEntries, resolveExternalCardOverlay, type ExternalCardOverlayInput } from "./externalCardOverlay";

/**
 * La surface `preview` — la mini-carte d'aperçu de bande-annonce du web et du
 * bureau : « Lire » en tête sur toutes les variantes, « Plus d'infos »
 * toujours, en dernier (sous la vidéo, rien ne dit ce que fait son clic). Et
 * la surface « card » — celle de toutes les plateformes — ne change pas d'un
 * octet.
 */

const VARIANTS: readonly CardOverlayVariant[] = ["poster", "landscape", "reco"];
const NONE = { watchlist: false, favorite: false, watched: false } as const;

/** Toutes les combinaisons d'entrée d'une variante — de quoi épuiser le modèle. */
function inputsOf(variant: CardOverlayVariant): CardOverlayInput[] {
  const out: CardOverlayInput[] = [];
  for (const inLibrary of [true, false]) {
    for (const playable of [true, false]) {
      for (const resume of [true, false]) {
        for (const offline of [true, false]) {
          for (const request of [true, false]) {
            for (const local of [true, false]) {
              out.push({ variant, inLibrary, playable, resume, rateable: true, offline, request, local });
            }
          }
        }
      }
    }
  }
  return out;
}

describe("surface « card » — rien ne change", () => {
  it("la même réponse avec ou sans `surface: \"card\"`, pour les trois variantes", () => {
    for (const variant of VARIANTS) {
      for (const input of inputsOf(variant)) {
        expect(resolveCardOverlay({ ...input, surface: "card" })).toEqual(resolveCardOverlay(input));
      }
    }
  });

  it("garde les plateaux de toujours : l'affiche lit, la vignette offre la fiche, la reco le refus", () => {
    const library = { inLibrary: true, playable: true, rateable: true, offline: true } as const;
    expect(resolveCardOverlay({ variant: "poster", ...library })).toMatchObject({ playInTray: true, extras: ["offline"] });
    expect(resolveCardOverlay({ variant: "landscape", ...library })).toMatchObject({ playInTray: false, extras: ["offline", "details"] });
    expect(resolveCardOverlay({ variant: "reco", ...library })).toMatchObject({ playInTray: true, extras: ["dismiss"] });
  });

  it("hors bibliothèque aussi", () => {
    const input: ExternalCardOverlayInput = { variant: "reco", request: null, identified: true };
    expect(resolveExternalCardOverlay({ ...input, surface: "card" })).toEqual(resolveExternalCardOverlay(input));
    expect(resolveExternalCardOverlay({ variant: "poster", request: null, identified: true }).extras).toEqual([]);
  });
});

describe("surface « preview » — la mini-carte", () => {
  const library = { inLibrary: true, playable: true, rateable: true, surface: "preview" } as const;

  it("met « Lire » en tête sur l'affiche ET sur la vignette — dont le clic lit, sans que rien ne le dise", () => {
    for (const variant of VARIANTS) {
      const overlay = resolveCardOverlay({ variant, ...library });
      expect(overlay.playInTray).toBe(true);
      expect(cardActionEntries(overlay, NONE)[0]).toEqual({ kind: "play", labelKey: "play" });
    }
    expect(resolveCardOverlay({ variant: "landscape", ...library, resume: true }).play).toEqual({ labelKey: "resume" });
  });

  it("garde ce que fait le clic de la carte : la fiche sur une affiche, la lecture sur une vignette", () => {
    expect(resolveCardOverlay({ variant: "poster", ...library }).open).toBe("details");
    expect(resolveCardOverlay({ variant: "landscape", ...library }).open).toBe("play");
  });

  it("offre toujours « Plus d'infos », en dernier — après le hors ligne et le refus", () => {
    expect(resolveCardOverlay({ variant: "poster", ...library }).extras).toEqual(["details"]);
    expect(resolveCardOverlay({ variant: "poster", ...library, offline: true }).extras).toEqual(["offline", "details"]);
    expect(resolveCardOverlay({ variant: "landscape", ...library, offline: true }).extras).toEqual(["offline", "details"]);
    expect(resolveCardOverlay({ variant: "reco", ...library }).extras).toEqual(["dismiss", "details"]);
    expect(resolveCardOverlay({ variant: "reco", ...library, inLibrary: false }).extras).toEqual(["dismiss", "details"]);
  });

  it("garde l'ordre du modèle : Lire → Ma liste → favori → vu → hors ligne → Plus d'infos", () => {
    const overlay = resolveCardOverlay({ variant: "poster", ...library, offline: true });
    expect(cardActionEntries(overlay, NONE).map((entry) => entry.kind))
      .toEqual(["play", "watchlist", "favorite", "watched", "offline", "details"]);
  });

  it("ne lit rien de ce qui ne se lit pas (collection, titre absent)", () => {
    expect(resolveCardOverlay({ variant: "poster", ...library, playable: false }).playInTray).toBe(false);
    expect(resolveCardOverlay({ variant: "reco", ...library, inLibrary: false }).play).toBeNull();
  });

  it("ne dépasse jamais six ronds — ce que la mini-carte tient dès 288 px", () => {
    for (const variant of VARIANTS) {
      // Une recommandation n'a jamais de saisons à demander : l'offre ne vit
      // que dans la recherche (`SeriesGapsScope`). Combinaison exclue — elle
      // ferait déjà six boutons sur la carte.
      for (const input of inputsOf(variant).filter((entry) => !(entry.variant === "reco" && entry.request))) {
        const overlay = resolveCardOverlay({ ...input, surface: "preview" });
        const count = (overlay.playInTray ? 1 : 0) + (overlay.request ? 1 : 0) + overlay.toggles.length + overlay.extras.length;
        expect(count).toBeLessThanOrEqual(6);
      }
    }
  });

  it("hors bibliothèque : « Demander » en tête, « Plus d'infos » en dernier", () => {
    const direct = { mode: "direct" as const, label: "Demander", href: null };
    const poster = resolveExternalCardOverlay({ variant: "poster", request: direct, identified: true, surface: "preview" });
    expect(externalCardActionEntries(poster, { watchlist: false }).map((entry) => entry.kind))
      .toEqual(["request", "watchlist", "favorite", "details"]);
    const reco = resolveExternalCardOverlay({ variant: "reco", request: direct, identified: true, surface: "preview" });
    expect(externalCardActionEntries(reco, { watchlist: false }).map((entry) => entry.kind))
      .toEqual(["request", "watchlist", "favorite", "dismiss", "details"]);
  });
});
