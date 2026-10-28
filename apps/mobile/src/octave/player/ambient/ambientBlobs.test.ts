import { describe, expect, it } from "vitest";
import { AMBIENT_CYCLE_S, ambientSeed } from "./ambientMotion";
import { ambientBlobs, blobBlurTaps, blobImageFrame, blobRasterScale, BLOB_RASTER_SIDE, BLOB_ZOOM } from "./ambientBlobs";

describe("les taches de couleur du fond (plusieurs teintes de la pochette)", () => {
  it("trois taches, chacune d'une région différente de la pochette", () => {
    for (const key of ["a", "b", "/api/music/artwork/1", null]) {
      const blobs = ambientBlobs(ambientSeed(key));
      expect(blobs).toHaveLength(3);
      expect(new Set(blobs.map((b) => `${b.focusX},${b.focusY}`)).size).toBe(3);
    }
  });

  it("posées loin les unes des autres, et stables pour un même titre", () => {
    const blobs = ambientBlobs(ambientSeed("x"));
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        expect(Math.hypot(blobs[i].anchorX - blobs[j].anchorX, blobs[i].anchorY - blobs[j].anchorY)).toBeGreaterThan(0.4);
      }
    }
    expect(ambientBlobs(ambientSeed("x"))).toEqual(blobs);
  });

  it("leur dérive boucle sans saut sur le cycle de l'horloge, et le battement reste discret", () => {
    for (const blob of ambientBlobs(ambientSeed("cycle"))) {
      expect(AMBIENT_CYCLE_S % blob.drift.driftPeriod).toBe(0);
      expect(AMBIENT_CYCLE_S % blob.drift.rotatePeriod).toBe(0);
      expect(blob.pulseScale).toBeLessThanOrEqual(0.08);
    }
  });

  it("la région visée est au centre de la tache, et la pochette agrandie couvre toute la tache", () => {
    const side = 300;
    for (const [fx, fy] of [[0.22, 0.22], [0.78, 0.78], [0.5, 0.5]]) {
      const frame = blobImageFrame(side, fx, fy);
      expect(frame.size).toBe(side * BLOB_ZOOM);
      expect(frame.x + fx * frame.size).toBeCloseTo(side / 2, 6);
      expect(frame.y + fy * frame.size).toBeCloseTo(side / 2, 6);
      expect(frame.x).toBeLessThanOrEqual(0);
      expect(frame.y).toBeLessThanOrEqual(0);
      expect(frame.x + frame.size).toBeGreaterThanOrEqual(side);
      expect(frame.y + frame.size).toBeGreaterThanOrEqual(side);
    }
  });

  it("dessinées petites (le flou coûte au fil principal) puis agrandies jusqu'à leur taille", () => {
    // Bien plus que la vignette (64 px) : rien de perdu ; bien moins que l'écran : un flou bon marché.
    expect(BLOB_RASTER_SIDE).toBeGreaterThanOrEqual(64);
    expect(BLOB_RASTER_SIDE).toBeLessThanOrEqual(128);
    expect(blobRasterScale(BLOB_RASTER_SIDE)).toBe(1);
    expect(BLOB_RASTER_SIDE * blobRasterScale(675)).toBeCloseTo(675);
  });

  it("le flou sans filtre : neuf copies empilées qui pèsent chacune autant (une moyenne)", () => {
    const taps = blobBlurTaps(96);
    expect(taps).toHaveLength(9);
    // Poids réel de chaque copie une fois empilée (la dernière par-dessus) : a_k × Π (1 − a_j) pour j > k.
    const weights = taps.map((tap, k) => taps.slice(k + 1).reduce((w, next) => w * (1 - next.opacity), tap.opacity));
    for (const w of weights) expect(w).toBeCloseTo(1 / 9);
    expect(taps[0]).toMatchObject({ dx: 0, dy: 0, opacity: 1 });
    for (const tap of taps.slice(1)) expect(Math.hypot(tap.dx, tap.dy)).toBeCloseTo(96 * 0.06);
  });
});
