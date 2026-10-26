import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le verre de la maquette dans la primitive (`material: "pane" | "bead"`) et
 * le fond ambiant : hors du mode natif, RIEN ne change (le rendu d'avant) ; en
 * natif, la classe-marqueur et ses attributs, sans lentille ni mesure.
 */

const state = vi.hoisted(() => ({ mode: "off" as "native" | "refraction" | "off" }));
vi.mock("../useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));

const { LiquidGlass } = await import("./LiquidGlass");
const { GlassAmbient } = await import("./GlassAmbient");

const render = (mode: typeof state.mode, node: ReactElement): string => {
  state.mode = mode;
  return renderToStaticMarkup(node);
};

describe("hors du mode natif", () => {
  for (const mode of ["off", "refraction"] as const) {
    it(`mode ${mode} : un verre « pane » rend exactement le balisage d'avant`, () => {
      const pane = render(
        mode,
        <LiquidGlass material="pane" tone="dark" level="prominent" shape="capsule" className="flex gap-2" fallbackClassName="bg-black/60 rounded-full">
          Lecture
        </LiquidGlass>,
      );
      expect(pane).toBe('<div class="flex gap-2 bg-black/60 rounded-full">Lecture</div>');
    });
    it(`mode ${mode} : le fond ambiant ne rend rien`, () => {
      expect(render(mode, <GlassAmbient tints={["10, 20, 30", "40, 50, 60"]} />)).toBe("");
    });
  }
});

describe("en mode natif", () => {
  it("un verre « pane » : sa classe, sa forme, son ton, l'action principale — ni lentille ni `.lg-surface`", () => {
    const html = render(
      "native",
      <LiquidGlass material="pane" tone="dark" level="prominent" shape="capsule" interactive className="flex gap-2" fallbackClassName="bg-black/60">
        Lecture
      </LiquidGlass>,
    );
    expect(html).toContain('class="lg-pane flex gap-2"');
    expect(html).toContain('data-lg-shape="capsule"');
    expect(html).toContain('data-lg-level="prominent"');
    expect(html).toContain('data-lg-tone="dark"');
    expect(html).toContain("data-lg-interactive");
    expect(html).not.toMatch(/lg-surface|data-lg-render|data-lg-scale|<svg|<filter|bg-black/);
  });

  it("une pastille « bead » ; un rayon seulement s'il est demandé", () => {
    expect(render("native", <LiquidGlass material="bead">Opus</LiquidGlass>)).toBe('<div class="lg-bead" data-lg-shape="rounded">Opus</div>');
    expect(render("native", <LiquidGlass material="pane" radius="lg" />)).toContain('data-lg-radius="lg"');
  });

  it("sans `material`, la lentille d'avant (rien ne change pour les appelants)", () => {
    const html = render("native", <LiquidGlass className="x">y</LiquidGlass>);
    expect(html).toContain("lg-surface");
    expect(html).toContain('data-lg-render="lens"');
  });

  it("le fond ambiant : une couche, nos couleurs, ou deux teintes données", () => {
    expect(render("native", <GlassAmbient />)).toBe('<div aria-hidden="true" class="lg-ambient"></div>');
    const tinted = render("native", <GlassAmbient tints={["10, 20, 30", "40, 50, 60"]} position="absolute" />);
    expect(tinted).toContain('data-lg-ambient="absolute"');
    expect(tinted).toContain("data-lg-ambient-tint");
    expect(tinted).toContain("--lg-ambient-tint-1:10, 20, 30");
  });
});
