import { describe, expect, it } from "vitest";
import { parseGradientColor, twoStopGradient } from "./twoStopGradient";

describe("le dégradé à deux arrêts", () => {
  it("lit les couleurs écrites par l'app", () => {
    expect(parseGradientColor("#fff")).toEqual([1, 1, 1, 1]);
    expect(parseGradientColor("rgba(0, 0, 0, 0.5)")).toEqual([0, 0, 0, 0.5]);
    expect(parseGradientColor("rgb(255,0,0)")).toEqual([1, 0, 0, 1]);
    expect(parseGradientColor("transparent")).toBeNull();
  });

  it("laisse tel quel un dégradé de deux arrêts, ou illisible, ou qui revient à son départ", () => {
    const two = { colors: ["#000", "#fff"], locations: [0.2, 1] };
    expect(twoStopGradient(two)).toEqual(two);
    const named = { colors: ["red", "#fff", "#000"] };
    expect(twoStopGradient(named)).toEqual(named);
    const loop = { colors: ["#000", "#fff", "#000"] };
    expect(twoStopGradient(loop)).toEqual(loop);
  });

  it("garde le départ, l'arrivée et l'endroit de la variation du voile du héros", () => {
    const scrim = (a: number) => `rgba(8, 8, 18, ${a})`;
    const out = twoStopGradient({ colors: [scrim(0.9), scrim(0.62), scrim(0.05), scrim(0)], locations: [0, 0.34, 0.64, 1] });
    expect(out.colors).toEqual([scrim(0.9), scrim(0)]);
    const [start, end] = out.locations as number[];
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(1);
    expect(start).toBeLessThan(end);
    // L'original passe la moitié du chemin vers 0,43 : la rampe aussi.
    const mid = start + (end - start) / 2;
    expect(Math.abs(mid - 0.43)).toBeLessThan(0.02);
  });

  it("répartit les arrêts sans `locations` écrites", () => {
    const out = twoStopGradient({ colors: ["rgba(255,255,255,0.26)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)"] });
    expect(out.colors).toHaveLength(2);
    expect(out.locations).toHaveLength(2);
  });
});
