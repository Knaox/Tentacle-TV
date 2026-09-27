/**
 * Les mesures audio et la frise qu'en tire le modèle, sur des signaux
 * fabriqués : silence, sinusoïdes. Le modèle lui-même a été validé au labo
 * (`docs/SEGMENTS-LABO-FIN.md`) ; ici, on vérifie que le portage mesure ce
 * qu'il dit mesurer.
 */

import { describe, expect, it } from "vitest";
import { FEATURE_COUNT, FEATURE_NAMES, SAMPLE_RATE, secondFeatures } from "./audioFeatures";
import { audioClasses, contextRow, speechProbabilities } from "./speechModel";

const feature = (row: Float64Array, name: (typeof FEATURE_NAMES)[number]): number => row[FEATURE_NAMES.indexOf(name)];

function sine(hz: number, seconds: number, amplitude = 0.5): Int16Array {
  const pcm = new Int16Array(SAMPLE_RATE * seconds);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(amplitude * 32767 * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));
  return pcm;
}

describe("secondFeatures", () => {
  it("une ligne de treize mesures par seconde entière de trames", async () => {
    const rows = await secondFeatures(new Int16Array(SAMPLE_RATE * 5));
    // 5 s = 311 trames de 16 ms ; 311 / 62,5 = 4 secondes pleines.
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.length === FEATURE_COUNT)).toBe(true);
    expect(feature(rows[0], "db")).toBe(-100);
    expect(await secondFeatures(new Int16Array(100))).toEqual([]);
  });

  it("une note tenue à 1 kHz : forte, tenue, centrée sur 1 kHz, sans basses ni aigus", async () => {
    const rows = await secondFeatures(sine(1_000, 5));
    const row = rows[2];
    expect(feature(row, "db")).toBeGreaterThan(-20);
    expect(feature(row, "db")).toBeLessThan(-5);
    expect(feature(row, "ler")).toBe(0);
    expect(feature(row, "centroid")).toBeCloseTo(0.25, 2);
    expect(feature(row, "persist")).toBeGreaterThan(0.9);
    expect(feature(row, "bass")).toBeLessThan(0.01);
    expect(feature(row, "high")).toBeLessThan(0.01);
  });

  it("une basse à 100 Hz tombe dans la bande des basses", async () => {
    const rows = await secondFeatures(sine(100, 4));
    expect(feature(rows[1], "bass")).toBeGreaterThan(0.9);
  });
});

describe("le modèle", () => {
  const silent = (): Float64Array => {
    const row = new Float64Array(FEATURE_COUNT);
    row[0] = -100;
    return row;
  };

  it("le contexte : la seconde, puis moyenne et écart-type sur ±3 s, bornés aux extrémités", () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => Float64Array.from({ length: FEATURE_COUNT }, () => v));
    const first = contextRow(rows, 0);
    expect(first).toHaveLength(FEATURE_COUNT * 3);
    expect(first[0]).toBe(0);
    expect(first[FEATURE_COUNT]).toBe(1.5); // moyenne de 0..3
    const middle = contextRow(rows, 4);
    expect(middle[FEATURE_COUNT]).toBe(4); // moyenne de 1..7
    expect(middle[2 * FEATURE_COUNT]).toBeCloseTo(2, 5);
  });

  it("des probabilités entre 0 et 1, une par seconde", () => {
    const p = speechProbabilities([silent(), silent(), silent()]);
    expect(p).toHaveLength(3);
    for (const v of p) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("le silence est Q ; une seconde isolée dans le silence est lissée", () => {
    const rows = Array.from({ length: 12 }, silent);
    rows[6] = Float64Array.from({ length: FEATURE_COUNT }, (_, i) => (i === 0 ? -20 : 0.3));
    expect(audioClasses(rows)).toBe("Q".repeat(12));
    expect(audioClasses([])).toBe("");
  });
});
