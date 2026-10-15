/**
 * La vidéo de la mini-carte grandit jusqu'à la scène de la fiche : elle doit
 * finir EXACTEMENT là où le décor sera peint (couverture, cadrage « center
 * 30% »), et partir EXACTEMENT de sa place dans la mini-carte — sinon on voit
 * un saut au premier ou au dernier instant.
 */
import { describe, expect, it } from "vitest";
import { launchFromTransform, stageCoverRect } from "./previewLaunchGeometry";

describe("stageCoverRect", () => {
  it("une scène plus haute qu'un 16:9 : pleine hauteur, débord partagé à gauche et à droite", () => {
    const cover = stageCoverRect({ width: 1440, height: 1160 }, 16 / 9);
    expect(cover.height).toBe(1160);
    expect(cover.width).toBeCloseTo(1160 * (16 / 9));
    expect(cover.left).toBeCloseTo((1440 - cover.width) / 2);
    expect(cover.top).toBe(0);
  });

  it("une scène plus large qu'un 16:9 : pleine largeur, cadrée au tiers haut comme le décor", () => {
    const cover = stageCoverRect({ width: 3000, height: 900 }, 16 / 9);
    expect(cover.width).toBe(3000);
    expect(cover.height).toBeCloseTo(3000 * (9 / 16));
    expect(cover.left).toBe(0);
    expect(cover.top).toBeCloseTo((900 - cover.height) * 0.3);
  });

  it("des proportions absurdes retombent sur le 16:9", () => {
    expect(stageCoverRect({ width: 1600, height: 900 }, 0)).toEqual({ left: 0, top: 0, width: 1600, height: 900 });
  });
});

describe("launchFromTransform", () => {
  it("ramène le rectangle d'arrivée sur la mini-carte (origine en haut à gauche)", () => {
    const to = { left: -300, top: 0, width: 2000, height: 1125 };
    const from = { left: 200, top: 500, width: 400, height: 225 };
    const t = launchFromTransform(from, to);
    expect(t.scale).toBeCloseTo(0.2);
    // Le coin haut gauche de l'élément, posé à `to`, tombe sur celui de la mini-carte…
    expect(to.left + t.x).toBe(from.left);
    expect(to.top + t.y).toBe(from.top);
    // … et son coin bas droit aussi : échelle uniforme, aucune déformation.
    expect(to.left + t.x + to.width * t.scale).toBeCloseTo(from.left + from.width);
    expect(to.top + t.y + to.height * t.scale).toBeCloseTo(from.top + from.height);
  });

  it("sans arrivée mesurable, ne bouge rien", () => {
    expect(launchFromTransform({ left: 1, top: 2, width: 3, height: 4 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
