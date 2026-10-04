import { describe, expect, it } from "vitest";
import { haloDrawing, RS_MAX_SIGMA } from "./haloDrawing";
import { RENDER_PROFILES } from "./renderProfile";

const rsSigma = (deviation: number) => 0.4 * Math.min(25, deviation * 2) + 0.6;

describe("le dessin d'un halo", () => {
  it("laisse à l'Apple TV son dessin au quart et son écart-type en points", () => {
    expect(haloDrawing(RENDER_PROFILES.tvos, 44, 2)).toEqual({ scale: 0.25, deviation: 11 });
    expect(haloDrawing(RENDER_PROFILES.tvos, 30, 1)).toEqual({ scale: 0.25, deviation: 7.5 });
  });

  it("donne à RenderScript l'écart-type qui rend le flou de l'Apple TV", () => {
    const { scale, deviation } = haloDrawing(RENDER_PROFILES.androidtv, 30, 1);
    expect(scale).toBe(0.25);
    expect(rsSigma(deviation)).toBeCloseTo(7.5);
  });

  it("réduit le dessin quand le flou dépasse le plafond de RenderScript", () => {
    const { scale, deviation } = haloDrawing(RENDER_PROFILES.androidtv, 44, 1);
    expect(rsSigma(deviation)).toBeCloseTo(RS_MAX_SIGMA);
    // Agrandi de 1 / scale, le flou vaut bien 44 points.
    expect(rsSigma(deviation) / scale).toBeCloseTo(44);
  });

  it("dessine à la densité 1 sur un téléviseur 4K", () => {
    const hd = haloDrawing(RENDER_PROFILES.androidtv, 30, 1);
    const uhd = haloDrawing(RENDER_PROFILES.androidtv, 30, 2);
    expect(uhd.scale).toBe(hd.scale / 2);
    expect(uhd.deviation).toBe(hd.deviation);
  });
});
