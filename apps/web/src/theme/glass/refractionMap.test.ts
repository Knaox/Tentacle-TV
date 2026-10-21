import { describe, expect, it } from "vitest";
import { buildRefractionMap, refractionProfile } from "@tentacle-tv/ui";

/**
 * La carte de déplacement de la lentille (`@tentacle-tv/ui`, glass/refractionMap) :
 * neutre au centre, inclinée vers l'INTÉRIEUR dans le biseau, qui suit les
 * coins. 128 = aucun déplacement ; rouge = X, vert = Y.
 */

const at = (map: ReturnType<typeof buildRefractionMap>, x: number, y: number) => {
  const offset = (y * map.width + x) * 4;
  return { r: map.data[offset], g: map.data[offset + 1], b: map.data[offset + 2], a: map.data[offset + 3] };
};

describe("refractionProfile", () => {
  it("maximal au bord, nul au bout du biseau, décroissant entre les deux", () => {
    expect(refractionProfile(0)).toBe(1);
    expect(refractionProfile(1)).toBe(0);
    let previous = 1;
    for (let t = 0.05; t < 1; t += 0.05) {
      const value = refractionProfile(t);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });
});

describe("buildRefractionMap", () => {
  const map = buildRefractionMap({ width: 200, height: 60, radius: 30, bezel: 14 });

  it("une carte à la taille de la surface, opaque", () => {
    expect(map.width).toBe(200);
    expect(map.height).toBe(60);
    expect(map.data.length).toBe(200 * 60 * 4);
    expect(at(map, 100, 30).a).toBe(255);
  });

  it("neutre au centre : l'image n'y bouge pas", () => {
    expect(at(map, 100, 30)).toMatchObject({ r: 128, g: 128 });
  });

  it("dans le biseau, l'image vient de l'intérieur", () => {
    // Bord haut, au milieu : on échantillonne plus BAS (vert > 128), X neutre.
    expect(at(map, 100, 1).g).toBeGreaterThan(200);
    expect(at(map, 100, 1).r).toBe(128);
    // Bord bas : plus HAUT.
    expect(at(map, 100, 58).g).toBeLessThan(56);
  });

  it("une capsule : les bouts sont des demi-cercles, la normale y est oblique", () => {
    // Bout gauche, au milieu de la hauteur : vers la droite (rouge > 128).
    expect(at(map, 1, 30).r).toBeGreaterThan(200);
    // Coin haut-gauche de l'arc : les deux axes vont vers l'intérieur.
    const corner = at(map, 10, 9);
    expect(corner.r).toBeGreaterThan(128);
    expect(corner.g).toBeGreaterThan(128);
    // Hors de la forme (l'angle du rectangle) : neutre.
    expect(at(map, 0, 0)).toMatchObject({ r: 128, g: 128 });
  });

  it("le biseau a une largeur CONSTANTE, quelle que soit la taille", () => {
    const wide = buildRefractionMap({ width: 1200, height: 68, radius: 12, bezel: 14 });
    // À 20 px du bord gauche (au-delà du biseau de 14), plus rien ne bouge —
    // l'ancien filtre étiré courbait 18 % de la largeur, soit 216 px.
    expect(at(wide, 20, 34)).toMatchObject({ r: 128, g: 128 });
    expect(at(wide, 3, 34).r).toBeGreaterThan(140);
  });

  it("une grande surface se calcule à résolution réduite", () => {
    const big = buildRefractionMap({ width: 1600, height: 900, radius: 28, bezel: 22 });
    expect(big.width * big.height).toBeLessThanOrEqual(160_000 + 2_000);
    expect(big.width / big.height).toBeCloseTo(1600 / 900, 1);
  });
});
