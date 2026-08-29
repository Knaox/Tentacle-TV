/**
 * Le collecteur ne décide rien, mais il peut mentir sur DEUX choses : la
 * position d'une vignette dans le média, et la géométrie d'une planche. Les
 * deux se vérifient sans réseau — les mesures d'une planche fabriquée à la main
 * doivent tomber exactement où on les attend.
 */

import { describe, expect, it } from "vitest";
import { pickTrickplay, sampleTile, tileRange, type TrickplayInfo } from "./trickplayFrames";

const INFO: TrickplayInfo = {
  Width: 4,
  Height: 2,
  TileWidth: 2,
  TileHeight: 2,
  ThumbnailCount: 8,
  Interval: 10_000,
};

/** Une planche 8 × 4 : quatre cellules de 4 × 2, chacune d'une couleur unie. */
function tile(colors: ReadonlyArray<[number, number, number]>): Uint8Array {
  const pixels = new Uint8Array(8 * 4 * 4);
  for (let cell = 0; cell < 4; cell++) {
    const [r, g, b] = colors[cell];
    const originX = (cell % 2) * 4;
    const originY = Math.floor(cell / 2) * 2;
    for (let y = originY; y < originY + 2; y++) {
      for (let x = originX; x < originX + 4; x++) {
        const i = (y * 8 + x) * 4;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }
  }
  return pixels;
}

describe("le choix de la planche", () => {
  it("prend la largeur la plus proche de 320", () => {
    const manifest = { src: { "160": INFO, "320": INFO, "480": INFO } };
    expect(pickTrickplay(manifest)?.width).toBe(320);
  });

  it("écarte un manifeste incohérent plutôt que de calculer faux", () => {
    expect(pickTrickplay(null)).toBeNull();
    expect(pickTrickplay({})).toBeNull();
    expect(pickTrickplay({ src: { "320": { ...INFO, Interval: 0 } } })).toBeNull();
  });
});

describe("les planches à lire", () => {
  it("part de 60 % du média et s'arrête à la dernière vignette qui existe", () => {
    // 80 s de média, une vignette toutes les 10 s, 4 par planche.
    expect(tileRange(INFO, 80_000)).toEqual({ first: 1, last: 1, truncated: false });
  });

  it("ne lit rien d'un média sans durée", () => {
    expect(tileRange(INFO, 0)).toBeNull();
  });

  it("renonce quand les vignettes ne couvrent pas la fin du média", () => {
    // Dix minutes de média mais huit vignettes seulement — un trickplay
    // fabriqué avant un remplacement de fichier. Analyser ce qu'on a
    // reviendrait à prendre le MILIEU du film pour son générique : on préfère
    // ne rien dire, et laisser les greffons parler seuls.
    expect(tileRange(INFO, 600_000)).toBeNull();
  });

  it("le dit quand il borne", () => {
    const long: TrickplayInfo = { ...INFO, ThumbnailCount: 4000, TileWidth: 1, TileHeight: 1 };
    const range = tileRange(long, 40_000_000);
    expect(range?.truncated).toBe(true);
  });
});

describe("la mesure d'une planche", () => {
  it("place chaque cellule à sa position dans le média", () => {
    const samples = sampleTile(tile([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), 8, 4, INFO, 1, 7);
    expect(samples.map((s) => s.ms)).toEqual([40_000, 50_000, 60_000, 70_000]);
  });

  it("compte le noir et la couleur", () => {
    const samples = sampleTile(
      tile([[0, 0, 0], [255, 255, 255], [255, 0, 0], [10, 10, 10]]),
      8, 4, INFO, 0, 7,
    );
    // Noir pur et gris très sombre : tout est « noir », sans couleur.
    expect(samples[0]).toEqual({ ms: 0, dark: 1, saturation: 0 });
    expect(samples[3]).toEqual({ ms: 30_000, dark: 1, saturation: 0 });
    // Blanc : rien de noir, rien de coloré. Rouge : rien de noir, saturé.
    expect(samples[1]).toEqual({ ms: 10_000, dark: 0, saturation: 0 });
    expect(samples[2]).toEqual({ ms: 20_000, dark: 0, saturation: 255 });
  });

  it("s'arrête à la dernière vignette réelle, sans lire le remplissage", () => {
    const samples = sampleTile(tile([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), 8, 4, INFO, 1, 5);
    expect(samples.map((s) => s.ms)).toEqual([40_000, 50_000]);
  });

  it("ne lit pas au-delà d'une planche plus petite qu'annoncé", () => {
    // Une planche tronquée : deux cellules seulement tiennent dans l'image.
    const samples = sampleTile(tile([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), 8, 2, INFO, 0, 7);
    expect(samples).toHaveLength(2);
  });
});
