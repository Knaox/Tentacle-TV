import { describe, expect, it } from "vitest";
import { contrastRatio, minContrastOnGradient } from "./contrast";

describe("contraste WCAG", () => {
  it("les repères connus", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // Le gris le plus clair qui tient AA sur blanc.
    expect(contrastRatio("#FFFFFF", "#767676")!).toBeGreaterThan(4.5);
    expect(contrastRatio("#FFFFFF", "#777777")!).toBeLessThan(4.5);
    expect(contrastRatio("nope", "#000")).toBeNull();
  });

  it("le pire point d'un dégradé", () => {
    // Le dégradé VIF de la marque ne tient pas un libellé blanc courant…
    expect(minContrastOnGradient("#FFFFFF", "#8B5CF6", "#EC4899")!).toBeLessThan(4.5);
    // … sa version profonde, si.
    expect(minContrastOnGradient("#FFFFFF", "#7C3AED", "#DB2777")!).toBeGreaterThanOrEqual(4.5);
  });
});
