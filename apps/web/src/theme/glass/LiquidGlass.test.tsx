import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * La primitive `<LiquidGlass>` dans les trois modes.
 *
 * L'essentiel est le premier test : hors du mode natif, le DOM rendu est
 * EXACTEMENT celui d'avant (mêmes classes, même style, aucun attribut de
 * plus) — c'est ce qui garantit le rendu d'avant au pixel près sur le web,
 * Windows, Linux et macOS < 26.
 */

const state = vi.hoisted(() => ({ mode: "off" as "native" | "refraction" | "off" }));
vi.mock("../useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));

const { LiquidGlass } = await import("./LiquidGlass");
const { useLiquidGlassSurface } = await import("./useLiquidGlassSurface");

const render = (mode: typeof state.mode, node: ReactElement): string => {
  state.mode = mode;
  return renderToStaticMarkup(node);
};

describe("hors du mode natif : le rendu d'avant, à l'identique", () => {
  for (const mode of ["off", "refraction"] as const) {
    it(`mode ${mode}`, () => {
      const glass = render(
        mode,
        <LiquidGlass
          as="nav"
          aria-label="Navigation"
          level="tinted"
          shape="capsule"
          interactive
          className="fixed top-0 flex gap-2"
          fallbackClassName="bg-black/60 backdrop-blur-xl border border-white/10"
          style={{ zIndex: 40 }}
        >
          <a href="/">Accueil</a>
        </LiquidGlass>,
      );
      const before = renderToStaticMarkup(
        <nav
          aria-label="Navigation"
          className="fixed top-0 flex gap-2 bg-black/60 backdrop-blur-xl border border-white/10"
          style={{ zIndex: 40 }}
        >
          <a href="/">Accueil</a>
        </nav>,
      );
      expect(glass).toBe(before);
    });
  }

  it("sans classe ni style : aucun attribut vide n'apparaît", () => {
    expect(render("off", <LiquidGlass>x</LiquidGlass>)).toBe("<div>x</div>");
  });
});

describe("mode natif", () => {
  it("sur la page : la lentille, la mise en page seule, les attributs du matériau", () => {
    const html = render(
      "native",
      <LiquidGlass
        level="regular"
        radius="lg"
        className="flex gap-2"
        fallbackClassName="bg-black/60 backdrop-blur-xl"
      >
        x
      </LiquidGlass>,
    );
    expect(html).toContain('class="lg-surface flex gap-2"');
    expect(html).toContain('data-lg-render="lens"');
    expect(html).toContain('data-lg-level="regular"');
    expect(html).toContain('data-lg-shape="rounded"');
    expect(html).toContain('data-lg-radius="lg"');
    expect(html).not.toContain("backdrop-blur-xl");
    expect(html).not.toContain("data-lg-interactive");
  });

  it("sur la fenêtre : le verre de macOS, la surface s'efface", () => {
    const html = render(
      "native",
      <LiquidGlass backdrop="window" level="clear" shape="capsule" interactive>
        x
      </LiquidGlass>,
    );
    expect(html).toContain('data-lg-render="native"');
    expect(html).toContain('data-lg-level="clear"');
    expect(html).toContain('data-lg-shape="capsule"');
    expect(html).toContain('data-lg-interactive=""');
    expect(html).not.toContain("data-lg-radius");
  });

  it("la teinte rose ne se dit que si on la demande", () => {
    const pink = render("native", <LiquidGlass level="prominent" tint="accent" />);
    const brand = render("native", <LiquidGlass level="prominent" />);
    expect(pink).toContain('data-lg-tint="accent"');
    expect(brand).not.toContain("data-lg-tint");
  });

  it("le régime `surface` se marque ; `control` (défaut) ne marque rien ; `bands` n'a plus d'effet", () => {
    const surface = render("native", <LiquidGlass scale="surface" bands />);
    expect(surface).toContain('data-lg-scale="surface"');
    expect(surface).not.toContain("bands");
    expect(surface).not.toContain("data-lg-band");
    expect(render("native", <LiquidGlass scale="control" />)).not.toContain("data-lg-scale");
    expect(render("native", <LiquidGlass />)).not.toContain("data-lg-scale");
    // Hors du mode natif : rien, comme pour tout le reste.
    expect(render("off", <LiquidGlass scale="surface" bands>x</LiquidGlass>)).toBe("<div>x</div>");
  });

  it("les props de l'élément passent, le type de l'élément suit `as`", () => {
    const html = render(
      "native",
      <LiquidGlass as="button" type="button" disabled aria-label="Lire" shape="circle" />,
    );
    expect(html).toMatch(/^<button type="button" disabled="" aria-label="Lire" class="lg-surface"/);
  });
});

describe("useLiquidGlassSurface : sur un élément qu'on ne remplace pas", () => {
  function Panel({ children }: { children: string }) {
    const glass = useLiquidGlassSurface({
      level: "regular",
      className: "absolute inset-x-0",
      fallbackClassName: "bg-surface-modal",
    });
    return (
      <section {...glass.props}>
        {glass.layers}
        {children}
      </section>
    );
  }

  it("rend les mêmes classes que le composant", () => {
    expect(render("off", <Panel>x</Panel>)).toBe('<section class="absolute inset-x-0 bg-surface-modal">x</section>');
    expect(render("native", <Panel>x</Panel>)).toContain('class="lg-surface absolute inset-x-0"');
  });
});
