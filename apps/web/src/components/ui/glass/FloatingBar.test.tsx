import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * `FloatingBar` (lot lg7, R2) : hors du verre natif, le balisage d'avant et
 * RIEN d'autre ; en natif, une capsule de verre par groupe, l'effet de bord
 * du bas, et plus la bande d'avant.
 */

const state = vi.hoisted(() => ({ mode: "off" as "native" | "refraction" | "off" }));
vi.mock("../../../theme/useLiquidGlass", () => ({ useLiquidGlassMode: () => state.mode }));
// Le portail rendu sur place (le rendu serveur n'en connaît pas).
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  createPortal: (node: unknown) => node,
}));

// Le rendu natif vise `document.body` : un corps factice suffit, le portail rend sur place.
vi.stubGlobal("document", { body: {}, documentElement: { setAttribute() {}, removeAttribute() {}, getAttribute: () => null, dataset: {}, style: {} } });

const { FloatingBar } = await import("./FloatingBar");

const LEGACY = (
  <div className="lg-bar fixed inset-x-0 bottom-0">
    <span>3 sélectionnés</span>
    <button type="button">Annuler</button>
  </div>
);

const bar = (edge: "bottom" | "top" = "bottom"): ReactElement => (
  <FloatingBar
    edge={edge}
    role="toolbar"
    label="Sélection"
    legacy={LEGACY}
    groups={[<span key="s" className="lg-fb-status">3 sélectionnés</span>, <button key="b" type="button" className="lg-fb-btn">Annuler</button>]}
  />
);

const render = (mode: typeof state.mode, node: ReactElement): string => {
  state.mode = mode;
  return renderToStaticMarkup(node);
};

describe("FloatingBar", () => {
  for (const mode of ["off", "refraction"] as const) {
    it(`mode ${mode} : exactement le balisage d'avant`, () => {
      expect(render(mode, bar())).toBe(renderToStaticMarkup(LEGACY));
    });
  }

  it("natif : deux capsules de verre, l'effet de bord du bas, plus de bande", () => {
    const html = render("native", bar());
    expect(html.match(/class="lg-surface lg-floating-bar-group/g)).toHaveLength(2);
    expect(html).toContain('class="lg-floating-bar-edge"');
    expect(html).toContain('role="toolbar"');
    expect(html).not.toContain("lg-bar ");
  });

  it("natif, sous la barre du haut : sans effet de bord du bas", () => {
    const html = render("native", bar("top"));
    expect(html).toContain('data-lg-edge="top"');
    expect(html).not.toContain("lg-floating-bar-edge");
  });
});
