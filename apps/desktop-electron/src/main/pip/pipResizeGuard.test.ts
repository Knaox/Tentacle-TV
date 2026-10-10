import { describe, expect, it } from "vitest";
import { PIP_INSET, PIP_MIN_WIDTH } from "./pipFrame";
import { boundedSize } from "./pipResizeGuard";

/** Le redimensionnement par le système : ratio gardé, bornes du PiP tenues. */
describe("boundedSize", () => {
  it("garde le ratio de l'image, cadre en plus", () => {
    const size = boundedSize(640 + 2 * PIP_INSET, 16 / 9, 900);
    expect(size).toEqual({ width: 640 + 2 * PIP_INSET, height: 360 + 2 * PIP_INSET });
  });

  it("ne descend pas sous les boutons, ne dépasse pas la part permise", () => {
    expect(boundedSize(100, 16 / 9, 900).width - 2 * PIP_INSET).toBe(PIP_MIN_WIDTH);
    expect(boundedSize(4000, 16 / 9, 900).width - 2 * PIP_INSET).toBe(900);
  });
});
