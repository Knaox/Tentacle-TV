import { describe, expect, it } from "vitest";
import { bezelHeight, buildLensMaps, buildRefractionMap, lensProfile } from "@tentacle-tv/ui";

/**
 * La lentille (`@tentacle-tv/ui`, glass/lensProfile et glass/refractionMap) :
 * un profil de Snell sur un biseau squircle — rien au centre, presque rien au
 * ras du bord, un anneau de forte déviation juste à l'intérieur —, une carte
 * qui suit la forme exacte, et une carte de lumière dont le liseré dépend de
 * l'orientation du bord face à la lumière.
 */

const at = (map: { width: number; data: Uint8ClampedArray }, x: number, y: number) => {
  const offset = (y * map.width + x) * 4;
  return { r: map.data[offset], g: map.data[offset + 1], b: map.data[offset + 2], a: map.data[offset + 3] };
};

describe("lensProfile (Snell, biseau squircle)", () => {
  it("nul au ras du bord et au bout du biseau", () => {
    expect(lensProfile(0)).toBe(0);
    expect(lensProfile(1)).toBe(0);
  });

  it("le maximum (1) est JUSTE à l'intérieur du bord, puis la déviation retombe", () => {
    let peakAt = 0;
    let peak = 0;
    for (let t = 0.001; t < 1; t += 0.001) {
      const value = lensProfile(t);
      if (value > peak) {
        peak = value;
        peakAt = t;
      }
    }
    expect(peak).toBeCloseTo(1, 2);
    expect(peakAt).toBeLessThan(0.12);
    // Au-delà du maximum, la déviation décroît, et le centre du biseau est calme.
    expect(lensProfile(0.2)).toBeLessThan(lensProfile(0.1));
    expect(lensProfile(0.6)).toBeLessThan(0.1);
  });

  it("le biseau monte de 0 au bord à 1 au bout", () => {
    expect(bezelHeight(0)).toBe(0);
    expect(bezelHeight(1)).toBe(1);
    expect(bezelHeight(0.5)).toBeGreaterThan(0.9);
  });
});

describe("buildLensMaps", () => {
  const geometry = { width: 200, height: 60, radius: 30, bezel: 14 };
  const light = { angle: 0, facing: 0.9, opposite: 0.4, base: 0.1, rim: 1.5, glow: 0.2 };
  const { displacement, specular } = buildLensMaps(geometry, light);

  it("une carte à la taille de la surface, opaque, neutre au centre", () => {
    expect(displacement.width).toBe(200);
    expect(displacement.data.length).toBe(200 * 60 * 4);
    expect(at(displacement, 100, 30)).toMatchObject({ r: 128, g: 128, a: 255 });
  });

  it("dans le biseau, l'image vient de l'intérieur (le contenu y est grossi)", () => {
    // Bord haut, au milieu : on échantillonne plus BAS (vert > 128), X neutre.
    expect(at(displacement, 100, 1).g).toBeGreaterThan(150);
    expect(at(displacement, 100, 1).r).toBe(128);
    expect(at(displacement, 100, 58).g).toBeLessThan(106);
    // Bout gauche d'une capsule : vers la droite.
    expect(at(displacement, 1, 30).r).toBeGreaterThan(150);
    // Hors de la forme (l'angle du rectangle) : neutre.
    expect(at(displacement, 0, 0)).toMatchObject({ r: 128, g: 128 });
  });

  it("le biseau a une largeur CONSTANTE, quelle que soit la taille", () => {
    const wide = buildRefractionMap({ width: 1200, height: 68, radius: 12, bezel: 14 });
    expect(at(wide, 20, 34)).toMatchObject({ r: 128, g: 128 });
    expect(at(wide, 2, 34).r).toBeGreaterThan(140);
  });

  it("la lumière : vive sur le bord qui lui fait face, plus douce en vis-à-vis, faible sur les flancs", () => {
    if (specular === null) throw new Error("carte de lumière attendue");
    const top = at(specular, 100, 0).a;
    const bottom = at(specular, 100, 59).a;
    expect(at(specular, 100, 0)).toMatchObject({ r: 255, g: 255, b: 255 });
    expect(top).toBeGreaterThan(200);
    expect(bottom).toBeGreaterThan(70);
    expect(bottom).toBeLessThan(top);
    // Au centre : aucune lumière.
    expect(at(specular, 100, 30).a).toBe(0);
  });

  it("sans lumière demandée, pas de carte de lumière", () => {
    expect(buildLensMaps(geometry).specular).toBeNull();
  });

  it("une grande surface se calcule à résolution réduite", () => {
    const big = buildRefractionMap({ width: 1600, height: 900, radius: 28, bezel: 22 });
    expect(big.width * big.height).toBeLessThanOrEqual(160_000 + 2_000);
    expect(big.width / big.height).toBeCloseTo(1600 / 900, 1);
  });
});
