/**
 * La lentille des segmentés de réglages : RIEN hors du mode natif (le DOM
 * d'avant, au nœud près), une lentille en natif.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", () => ({
  motion: { span: ({ className }: { className?: string }) => <span className={className} /> },
  useReducedMotion: () => false,
}));

const state = { mode: "refraction" as "native" | "refraction" | "off" };
vi.mock("../../../theme/useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));

const { SegmentLens } = await import("./SegmentLens");
const { SegmentedChoice } = await import("../../settings/SegmentedChoice");

const choice = () =>
  renderToStaticMarkup(
    <SegmentedChoice label="Délai" value="b" onChange={() => undefined} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />,
  );

describe("SegmentLens", () => {
  it("ne rend rien hors du mode natif, et le segmenté garde son balisage d'avant", () => {
    for (const mode of ["refraction", "off"] as const) {
      state.mode = mode;
      expect(renderToStaticMarkup(<SegmentLens group="g" />)).toBe("");
      expect(choice()).not.toContain("lg-seg-lens");
    }
  });

  it("en natif, une seule lentille, dans le segment choisi", () => {
    state.mode = "native";
    const html = choice();
    expect(html.match(/lg-seg-lens/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*><span[^>]*lg-seg-lens/);
  });
});
