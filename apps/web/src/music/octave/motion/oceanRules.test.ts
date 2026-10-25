/**
 * Les règles PURES du mouvement « océan » : la vague boucle sans couture,
 * l'état suit lecture et visibilité, la teinte d'une pochette est sûre, une
 * scène qui couvre tout suspend les houles.
 */

import { describe, expect, it } from "vitest";
import { rgbTriplet, tintFromPixels } from "./artworkTint";
import { coverPages, pagesCovered } from "./oceanCover";
import { swellState } from "./swellState";
import { waveBodyPath, wavePath } from "./wavePath";

/** Les points d'arrivée du tracé (x, y), dans l'ordre. */
function endpoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [, cmd, args] of d.matchAll(/([MQT])([^MQTVHZ]+)/g)) {
    const n = (args as string).trim().split(/\s+/).map(Number);
    const take = cmd === "Q" ? n.slice(2) : n;
    out.push([take[0] as number, take[1] as number]);
  }
  return out;
}

describe("wavePath", () => {
  const spec = { period: 16, amplitude: 2, baseline: 10, from: -4, to: 36 };

  it("couvre toute la largeur demandée, au-delà des bords", () => {
    const xs = endpoints(wavePath(spec)).map(([x]) => x);
    expect(xs[0]).toBeLessThanOrEqual(-4);
    expect(xs[xs.length - 1]).toBeGreaterThanOrEqual(36);
  });

  it("une demi-période par segment, sur la ligne de flottaison : décalée d'une période, la vague retombe sur elle-même", () => {
    const points = endpoints(wavePath(spec));
    for (const [, y] of points) expect(y).toBe(10);
    for (let i = 1; i < points.length; i += 1) expect((points[i] as [number, number])[0] - (points[i - 1] as [number, number])[0]).toBe(8);
    // Les abscisses tombent sur la grille de la période : un décalage de 16 (50 % du calque) ne change rien.
    for (const [x] of points) expect(((x % 8) + 8) % 8).toBe(0);
  });

  it("la crête monte de l'amplitude (contrôle à deux fois l'amplitude)", () => {
    expect(wavePath(spec)).toContain("Q-12 6 -8 10");
  });

  it("la phase décale la grille des crêtes", () => {
    const xs = endpoints(wavePath({ ...spec, phase: 5 })).map(([x]) => x);
    for (const x of xs) expect((((x - 5) % 8) + 8) % 8).toBe(0);
  });

  it("le corps d'eau se referme au fond", () => {
    const body = waveBodyPath({ period: 600, amplitude: 20, baseline: 60, from: -100, to: 1900 }, 200);
    expect(body).toMatch(/ V200 H-600 Z$/);
  });
});

describe("swellState", () => {
  it("en lecture et visible : la mer roule", () => expect(swellState(true, true)).toBe("run"));
  it("en lecture mais invisible : suspendue, la forme gardée", () => expect(swellState(true, false)).toBe("still"));
  it("en pause : la mer se calme, visible ou non", () => {
    expect(swellState(false, true)).toBe("rest");
    expect(swellState(false, false)).toBe("rest");
  });
});

function pixels(...colors: Array<[number, number, number, number?]>): number[] {
  return colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
}

describe("tintFromPixels", () => {
  it("la couleur vive l'emporte sur un fond sombre et terne", () => {
    const data = pixels(...Array.from({ length: 40 }, (): [number, number, number] => [20, 20, 22]), ...Array.from({ length: 8 }, (): [number, number, number] => [220, 30, 30]));
    const tint = tintFromPixels(data);
    expect(tint).not.toBeNull();
    const [r, g, b] = tint as readonly [number, number, number];
    expect(r).toBeGreaterThan(g + 80);
    expect(r).toBeGreaterThan(b + 80);
  });

  it("ramenée dans une plage sûre : ni noire, ni blanche", () => {
    const tint = tintFromPixels(pixels([10, 10, 60], [12, 8, 70])) as readonly [number, number, number];
    const lightness = (Math.max(...tint) + Math.min(...tint)) / 2 / 255;
    expect(lightness).toBeGreaterThan(0.55);
    expect(lightness).toBeLessThan(0.7);
  });

  it("une pochette en noir et blanc n'a pas de teinte (l'eau garde le rose)", () => {
    expect(tintFromPixels(pixels([0, 0, 0], [255, 255, 255], [128, 128, 128], [40, 40, 40]))).toBeNull();
  });

  it("les pixels transparents ne comptent pas ; une image vide n'a pas de teinte", () => {
    expect(tintFromPixels(pixels([255, 0, 0, 0]))).toBeNull();
    expect(tintFromPixels([])).toBeNull();
  });

  it("le triplet a la forme de --oc-accent-rgb", () => {
    expect(rgbTriplet([236, 72, 153])).toBe("236, 72, 153");
  });
});

describe("coverPages", () => {
  it("compte les scènes, prévient les abonnés, et une libération ne compte qu'une fois", () => {
    expect(pagesCovered()).toBe(false);
    const a = coverPages();
    const b = coverPages();
    expect(pagesCovered()).toBe(true);
    a();
    a();
    expect(pagesCovered()).toBe(true);
    b();
    expect(pagesCovered()).toBe(false);
  });
});
