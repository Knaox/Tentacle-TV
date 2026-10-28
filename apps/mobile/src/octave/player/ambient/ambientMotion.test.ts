import { describe, expect, it } from "vitest";
import {
  AMBIENT_BRAND_TINT, AMBIENT_CYCLE_S, ambientArtworkUrl, ambientLayers, ambientSeed, ambientShouldRun, layerSide, layerTransform,
} from "./ambientMotion";

const ALL_ON = { open: true, appActive: true, playing: true, reduceMotion: false };

describe("fond vivant du lecteur", () => {
  it("ne bouge que lecteur ouvert, app au premier plan, en lecture, sans mouvement réduit", () => {
    expect(ambientShouldRun(ALL_ON)).toBe(true);
    expect(ambientShouldRun({ ...ALL_ON, open: false })).toBe(false);
    expect(ambientShouldRun({ ...ALL_ON, appActive: false })).toBe(false);
    expect(ambientShouldRun({ ...ALL_ON, playing: false })).toBe(false);
    expect(ambientShouldRun({ ...ALL_ON, reduceMotion: true })).toBe(false);
  });

  it("boucle sans saut : chaque période divise le cycle", () => {
    for (const seed of [0, 1, ambientSeed("/api/music/a.jpg"), ambientSeed("x")]) {
      for (const layer of [...ambientLayers(seed), AMBIENT_BRAND_TINT]) {
        expect(AMBIENT_CYCLE_S % layer.driftPeriod).toBe(0);
        expect(AMBIENT_CYCLE_S % layer.rotatePeriod).toBe(0);
        const start = layerTransform(layer, 0, 390, 844);
        const end = layerTransform(layer, AMBIENT_CYCLE_S, 390, 844);
        expect(end.translateX).toBeCloseTo(start.translateX, 6);
        expect(end.translateY).toBeCloseTo(start.translateY, 6);
        expect(end.rotateDeg).toBeCloseTo(start.rotateDeg, 6);
        expect(end.scale).toBeCloseTo(start.scale, 6);
      }
    }
  });

  it("dérive lentement : moins de 2 pt par image à 60 i/s", () => {
    for (const layer of ambientLayers(ambientSeed("lent"))) {
      let worst = 0;
      for (let s = 0; s < 120; s += 1 / 60) {
        const a = layerTransform(layer, s, 390, 844);
        const b = layerTransform(layer, s + 1 / 60, 390, 844);
        worst = Math.max(worst, Math.abs(b.translateX - a.translateX), Math.abs(b.translateY - a.translateY));
      }
      expect(worst).toBeLessThan(2);
    }
  });

  it("couvre toujours l'écran : un calque tourné et poussé ne montre jamais son bord", () => {
    const [w, h] = [390, 844];
    for (const layer of [...ambientLayers(ambientSeed("couvre")), AMBIENT_BRAND_TINT]) {
      const side = layerSide(w, h, layer);
      for (let s = 0; s < AMBIENT_CYCLE_S; s += 0.5) {
        const t = layerTransform(layer, s, w, h);
        // Le cercle inscrit du calque (le pire cas d'une rotation) contient les quatre coins de l'écran.
        const radius = (side * t.scale) / 2;
        const reach = Math.hypot(w / 2 + Math.abs(t.translateX), h / 2 + Math.abs(t.translateY));
        expect(radius).toBeGreaterThanOrEqual(reach);
      }
    }
  });

  it("donne à chaque titre sa disposition, stable d'un rendu à l'autre", () => {
    expect(ambientLayers(ambientSeed("a"))).toEqual(ambientLayers(ambientSeed("a")));
    const a = ambientLayers(ambientSeed("/api/music/album/1/art"));
    const b = ambientLayers(ambientSeed("/api/music/album/2/art"));
    expect(a.map((l) => [l.driftPeriod, l.rotatePeriod, l.phase])).not.toEqual(b.map((l) => [l.driftPeriod, l.rotatePeriod, l.phase]));
    expect(ambientLayers(ambientSeed(null))).toHaveLength(3);
  });

  it("lit une vignette du serveur, jamais l'image d'un autre hôte retouchée", () => {
    expect(ambientArtworkUrl("/api/music/art/1")).toBe("/api/music/art/1?size=160");
    expect(ambientArtworkUrl("/api/music/art/1?v=2")).toBe("/api/music/art/1?v=2&size=160");
    expect(ambientArtworkUrl("/api/music/art/1?size=64")).toBe("/api/music/art/1?size=64");
    expect(ambientArtworkUrl("https://coverartarchive.org/x.jpg")).toBe("https://coverartarchive.org/x.jpg");
    expect(ambientArtworkUrl("file:///kept/1.jpg")).toBe("file:///kept/1.jpg");
    expect(ambientArtworkUrl(null)).toBeNull();
  });
});
