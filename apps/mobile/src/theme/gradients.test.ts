/**
 * Le bouton de lecture du mobile : son dégradé tient un libellé blanc en AA
 * (4,5:1) d'un bout à l'autre, dans les deux schémas — les mêmes arrêts que
 * le web (`--cta-brand-gradient`).
 */

import { describe, expect, it } from "vitest";
import { buildDarkPalette, buildLightPalette, minContrastOnGradient } from "@tentacle-tv/theme";
import { ctaGradient } from "./gradients";

describe("ctaGradient", () => {
  it.each([
    ["sombre", buildDarkPalette()],
    ["clair", buildLightPalette()],
  ])("libellé blanc ≥ 4,5:1 sur tout le dégradé (%s)", (_name, palette) => {
    const [from, to] = ctaGradient(palette.brand).colors;
    expect(minContrastOnGradient("#FFFFFF", from, to)).toBeGreaterThanOrEqual(4.5);
  });

  it("les arrêts du web : brand.dark → brand.accentDark", () => {
    const dark = buildDarkPalette();
    expect(ctaGradient(dark.brand).colors).toEqual([dark.brand.dark, dark.brand.accentDark]);
  });
});
