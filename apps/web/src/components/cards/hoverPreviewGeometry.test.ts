import { describe, expect, it } from "vitest";
import {
  canAnchorPreview,
  computePreviewRect,
  estimatePreviewHeight,
  previewHorizontalShift,
  previewOrigin,
  type AnchorRect,
} from "./hoverPreviewGeometry";

/**
 * Géométrie du panneau d'aperçu.
 *
 * Elle se vérifie mal à l'œil : le panneau s'ouvre après un délai, se referme
 * au moindre défilement, et l'écart qu'on cherche à débusquer se compte en
 * dizaines de pixels sur une image qui, elle, ne bouge pas. Un décalage de
 * 48 px — la hauteur du bloc titre d'une carte — est passé inaperçu tant que le
 * panneau ne se déroulait que vers le bas : les deux boîtes partagent alors
 * leur bord HAUT, et c'est le bord BAS qui diverge.
 */

/** Mesures réelles d'une rangée « Reprendre la lecture » en 1440 × 900. */
const VIEWPORT = { width: 1440, height: 900 };
const BOUNDS = { left: 56, right: 1376 };
/** Le VISUEL d'une carte, pas la carte : 16:9, sans le bloc titre. */
const card = (over: Partial<AnchorRect> = {}): AnchorRect => ({
  top: 325,
  left: 414,
  width: 346,
  height: 194,
  ...over,
});

describe("butée horizontale", () => {
  it("ne décale pas une carte entièrement visible", () => {
    expect(previewHorizontalShift(card(), VIEWPORT.width, BOUNDS)).toBe(0);
  });

  it("cale le panneau sur le bord de la rangée quand la carte le dépasse", () => {
    // Dernière carte visible de la rangée : rognée de 99 px, soit 28,6 %.
    const cut = card({ left: 1129 });
    expect(previewHorizontalShift(cut, VIEWPORT.width, BOUNDS)).toBe(99);
    const rect = computePreviewRect(cut, VIEWPORT, BOUNDS);
    expect(rect.left + rect.width).toBe(BOUNDS.right);
  });

  it("accepte ce rognage de 28,6 %, refuse au-delà d'un tiers", () => {
    expect(canAnchorPreview(card({ left: 1129 }), VIEWPORT, BOUNDS)).toBe(true);
    // 120 px de décalage = 34,7 % de la carte : le panneau mordrait trop sur la
    // voisine pour désigner encore son propre média.
    expect(canAnchorPreview(card({ left: 1151 }), VIEWPORT, BOUNDS)).toBe(false);
  });
});

describe("sens de déploiement", () => {
  it("descend quand la place est suffisante", () => {
    const rect = computePreviewRect(card(), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("down");
    // Ancré par le HAUT, sur le haut du visuel.
    expect(rect.top).toBe(325);
    expect(rect.bottom).toBeUndefined();
  });

  it("remonte quand la carte est trop basse, ancré sur le BAS du visuel", () => {
    // Carte en bas de fenêtre : son visuel court de 628 à 822.
    const low = card({ top: 628 });
    const rect = computePreviewRect(low, VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("up");
    expect(rect.top).toBeUndefined();
    // C'est LA régression à empêcher : l'ancre doit être le bas du VISUEL
    // (900 − 822 = 78), pas celui de la carte titre compris (900 − 870 = 30),
    // sinon la vignette du panneau atterrit 48 px sous celle de la carte.
    expect(rect.bottom).toBe(78);
  });

  it("choisit le côté le plus dégagé quand aucun des deux ne suffit", () => {
    // Fenêtre trop courte pour le panneau (345 px) dans les deux sens : il
    // débordera de toute façon, autant que ce soit du côté le plus large.
    const short = { width: 1440, height: 300 };
    expect(computePreviewRect(card({ top: 100 }), short, BOUNDS).direction).toBe("up");
    // Carte collée en haut : il reste plus de place dessous, on garde le bas —
    // qui est aussi le cas nominal, donc le repli naturel à égalité.
    expect(computePreviewRect(card({ top: 20 }), short, BOUNDS).direction).toBe("down");
  });
});

describe("origine du zoom", () => {
  const heightOf = (width: number) => estimatePreviewHeight(width);

  it("vise le centre de la vignette en déploiement vers le bas", () => {
    const anchor = card();
    const rect = computePreviewRect(anchor, VIEWPORT, BOUNDS);
    // Centre du visuel = 325 + 97 ; panneau ancré à 325 sur 344,6 de haut.
    const expected = ((97 / heightOf(anchor.width)) * 100).toFixed(0);
    expect(previewOrigin(anchor, rect).split(" ")[1]).toContain(expected);
  });

  it("vise le BAS du panneau en déploiement vers le haut", () => {
    const anchor = card({ top: 628 });
    const rect = computePreviewRect(anchor, VIEWPORT, BOUNDS);
    const y = parseFloat(previewOrigin(anchor, rect).split(" ")[1]);
    // La vignette occupe le bas du panneau : son centre est aux ~72 %.
    expect(y).toBeGreaterThan(65);
    expect(y).toBeLessThan(85);
  });
});
