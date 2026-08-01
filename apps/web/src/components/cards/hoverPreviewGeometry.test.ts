import { describe, expect, it } from "vitest";
import {
  canAnchorPreview,
  computePreviewRect,
  estimatePreviewHeight,
  previewOrigin,
  previewOverflow,
  type AnchorRect,
} from "./hoverPreviewGeometry";

/**
 * Géométrie du panneau d'aperçu.
 *
 * Elle se vérifie mal à l'œil : le panneau s'ouvre après un délai, et l'écart
 * qu'on cherche à débusquer se compte en dizaines de pixels sur une image qui,
 * elle, ne bouge pas. Un décalage de 48 px — la hauteur du bloc titre d'une
 * carte — est passé inaperçu tant que le panneau ne se déroulait que vers le
 * bas : les deux boîtes partagent alors leur bord HAUT.
 *
 * La règle que ces tests figent : le panneau part de la carte et n'en bouge
 * JAMAIS. Quand la place manque, ou quand la carte est rognée par le bord de la
 * rangée, c'est la DISPOSITION qui change, pas la position.
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

describe("le panneau ne bouge jamais de sa carte", () => {
  it("reprend exactement l'origine de la carte, entière ou rognée", () => {
    for (const left of [56, 414, 1129]) {
      const rect = computePreviewRect(card({ left }), VIEWPORT, BOUNDS);
      expect(rect.left).toBe(left);
      expect(rect.top).toBe(325);
      expect(rect.width).toBe(346);
    }
  });

  it("n'oppose plus aucun refus", () => {
    // Trois cas qui étaient tous refusés par les versions précédentes.
    expect(canAnchorPreview(card({ left: 1129 }))).toBe(true); // rognée à droite
    expect(canAnchorPreview(card({ top: 780 }))).toBe(true); // collée en bas
    expect(canAnchorPreview(card({ left: -100 }))).toBe(true); // rognée à gauche
    expect(canAnchorPreview(card({ width: 0 }))).toBe(false); // pas encore mesurée
  });
});

describe("dépassement des bornes de rangée", () => {
  it("est nul quand la carte est entièrement visible", () => {
    expect(previewOverflow(card(), VIEWPORT.width, BOUNDS)).toEqual({ left: 0, right: 0 });
  });

  it("mesure le rognage de la dernière carte visible", () => {
    // 1129 + 346 = 1475, soit 99 px au-delà de la borne droite (28,6 %).
    expect(previewOverflow(card({ left: 1129 }), VIEWPORT.width, BOUNDS)).toEqual({
      left: 0,
      right: 99,
    });
  });

  it("mesure aussi le rognage à gauche, rangée défilée", () => {
    expect(previewOverflow(card({ left: 20 }), VIEWPORT.width, BOUNDS)).toEqual({
      left: 36,
      right: 0,
    });
  });

  it("ignore l'écart sub-pixel de la carte de tête", () => {
    // `useRowCardWidth` divise la rangée en un nombre ENTIER de cartes : la
    // première commence exactement sur la borne. Deux mesures DOM de la même
    // arête peuvent malgré tout différer de quelques dix-millièmes de pixel, et
    // cela suffisait à basculer la carte en superposition avec un rognage
    // invisible — le survol changeait de forme au hasard des arrondis.
    expect(previewOverflow(card({ left: 55.9998 }), VIEWPORT.width, BOUNDS)).toEqual({
      left: 0,
      right: 0,
    });
    // Un débordement réel, même d'un seul pixel, reste rapporté : la tolérance
    // absorbe l'arrondi, pas le rognage.
    expect(previewOverflow(card({ left: 1031 }), VIEWPORT.width, BOUNDS).right).toBe(1);
  });
});

describe("disposition", () => {
  it("déroule le tiroir dessous quand la carte est entière et la place suffisante", () => {
    const rect = computePreviewRect(card(), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("down");
    // Hauteur libre (suit le contenu) et aucun rognage.
    expect(rect.height).toBeUndefined();
    expect(rect.clip).toBeUndefined();
  });

  it("passe en superposition quand la place manque en bas", () => {
    // Visuel de 628 à 822 : le panneau déroulé ferait 345 px, il déborderait.
    const rect = computePreviewRect(card({ top: 628 }), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("overlay");
    // Confiné à la carte : même hauteur, donc rien qui dépasse.
    expect(rect.height).toBe(194);
    expect(rect.top).toBe(628);
  });

  it("couvre la carte ENTIÈRE en superposition, bloc titre compris", () => {
    // 194 px d'image + 50 px de titre et de durée. Le panneau couvrait la seule
    // image : la carte gardait son titre visible sous un voile qui le répétait.
    const rect = computePreviewRect(card({ top: 628, outerHeight: 244 }), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("overlay");
    expect(rect.height).toBe(244);
    // L'origine du zoom reste le centre de l'IMAGE (97 px sur 244), pas celui du
    // panneau : sinon l'image dériverait à l'ouverture.
    expect(previewOrigin(card({ top: 628, outerHeight: 244 }), rect)).toBe("50% 39.75409836065574%");
  });

  it("passe en superposition ET se rogne comme la carte au bord de la rangée", () => {
    const rect = computePreviewRect(card({ left: 1129 }), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("overlay");
    // Sans ce rognage, le panneau — portalisé hors du conteneur qui rogne la
    // carte — révélerait une partie qu'elle ne montre pas.
    expect(rect.clip).toEqual({ left: 0, right: 99 });
  });

  it("fait primer le bord de rangée sur la place disponible", () => {
    // Même avec toute la place du monde en dessous, une carte rognée reste en
    // superposition : c'est le débordement qui décide en premier.
    const rect = computePreviewRect(card({ left: 1129, top: 100 }), VIEWPORT, BOUNDS);
    expect(rect.direction).toBe("overlay");
  });
});

describe("origine du zoom", () => {
  it("vise le centre de la vignette quand le tiroir se déroule dessous", () => {
    const anchor = card();
    const rect = computePreviewRect(anchor, VIEWPORT, BOUNDS);
    // Centre du visuel à 97 px du haut, panneau de 344,6 px de haut.
    const expected = Math.round((97 / estimatePreviewHeight(anchor.width)) * 100);
    expect(previewOrigin(anchor, rect)).toContain(`${expected}`);
  });

  it("vise le centre du panneau en superposition — il EST la vignette", () => {
    const anchor = card({ top: 628 });
    const rect = computePreviewRect(anchor, VIEWPORT, BOUNDS);
    expect(previewOrigin(anchor, rect)).toBe("50% 50%");
  });
});
