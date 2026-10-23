import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * `GlassButton inSurface` (lot lg7, R3) : hors du mode natif, EXACTEMENT le
 * bouton d'avant — celui que rend la primitive ; en natif, la peau peinte
 * (marqueurs `.lg-surface-btn`), sans lentille ni mesure du ton.
 */

const state = vi.hoisted(() => ({ mode: "off" as "native" | "refraction" | "off" }));
vi.mock("../../../theme/useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));

const { GlassButton } = await import("./GlassButton");

const render = (mode: typeof state.mode, node: ReactElement): string => {
  state.mode = mode;
  return renderToStaticMarkup(node);
};

const button = (inSurface: boolean, extra: { danger?: boolean } = {}) => (
  <GlassButton
    inSurface={inSurface}
    {...extra}
    onClick={() => {}}
    disabled
    appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
    className="px-5 py-2 text-sm font-bold disabled:opacity-50"
    fallbackClassName="rounded-md bg-cta-primary-bg text-cta-primary-fg"
    fallbackStyle={{ boxShadow: "none" }}
  >
    Lancer
  </GlassButton>
);

describe("GlassButton dans une surface", () => {
  for (const mode of ["off", "refraction"] as const) {
    it(`mode ${mode} : le même balisage que le bouton à lentille`, () => {
      expect(render(mode, button(true))).toBe(render(mode, button(false)));
      expect(render(mode, button(true, { danger: true }))).toBe(render(mode, button(false)));
    });
  }

  it("natif : la peau peinte, aucune lentille, aucune peau d'avant", () => {
    const html = render("native", button(true));
    expect(html).toContain('class="lg-surface-btn lg-surface-btn-prominent px-5 py-2');
    expect(html).not.toMatch(/data-lg-lens|lg-surface\b(?!-)|bg-cta-primary-bg|box-shadow/);
  });

  it("natif : le danger prend le rouge au ton, jamais la marque", () => {
    const html = render("native", button(true, { danger: true }));
    expect(html).toContain('class="lg-surface-btn lg-surface-btn-danger');
    expect(html).not.toContain("lg-surface-btn-prominent");
  });
});
