import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Quand une surface du lecteur demande-t-elle une région de verre NATIVE ?
 * Seulement verre natif + surface à l'écran + hors PiP. La couture vers les
 * socles (`nativeGlassPort`) est remplacée : on lit ce que chaque surface lui
 * demande, au rendu.
 */

const calls = vi.hoisted(() => [] as Array<{ active: boolean; group: string | undefined }>);
const transitions = vi.hoisted(() => [] as number[]);
const materializes = vi.hoisted(() => [] as unknown[]);
const native = vi.hoisted(() => ({ available: true }));
const viewport = vi.hoisted(() => ({ resizing: false }));
const backdrop = vi.hoisted(() => ({ tone: "dark" as "dark" | "light", asked: [] as boolean[] }));
vi.mock("./nativeGlassPort", () => ({
  useNativeGlassAvailable: () => native.available,
  videoUnderWindow: () => true,
  useNativeGlassRegion: (_ref: unknown, options: { active: boolean; group: string; transition: number; materialize?: unknown }) => {
    calls.push({ active: options.active, group: options.group });
    transitions.push(options.transition);
    materializes.push(options.materialize);
  },
  useVideoBackdropTone: (_element: unknown, active: boolean) => {
    backdrop.asked.push(active);
    return backdrop.tone;
  },
}));
vi.mock("./windowResizing", () => ({ useWindowResizing: () => viewport.resizing }));
const presence = vi.hoisted(() => ({ present: true, reduced: false }));
vi.mock("framer-motion", () => ({ useIsPresent: () => presence.present }));
vi.mock("./useLiveReducedMotion", () => ({ useLiveReducedMotion: () => presence.reduced }));

const { GlassSurface, GlassChromeVisibleContext, NATIVE_FADE_MS } = await import("./GlassSurface");
const { PlayerGlassProvider } = await import("./PlayerGlassContext");
const { MATERIALIZE, MATERIALIZE_REDUCED } = await import("./playerGlassMaterialize");
const { PictureInPictureContext } = await import("../../../pictureInPicture/pictureInPictureContext");
// Le verre de Tentacle est coupé d'office (lot « fl ») : ces cas sont ceux d'un utilisateur qui l'a allumé.
(await import("../../../theme/liquidGlass")).setLiquidGlass(true);

const pip = (active: boolean) => ({ supported: true, active }) as never;

function render(node: ReactNode, { inPip = false } = {}) {
  calls.length = 0;
  transitions.length = 0;
  const html = renderToStaticMarkup(
    <PictureInPictureContext.Provider value={pip(inPip)}>
      <PlayerGlassProvider>{node}</PlayerGlassProvider>
    </PictureInPictureContext.Provider>,
  );
  return { html, calls: [...calls] };
}

describe("les régions natives du lecteur", () => {
  beforeEach(() => {
    native.available = true; viewport.resizing = false; presence.present = true; presence.reduced = false;
    backdrop.tone = "dark"; backdrop.asked.length = 0;
  });

  it("verre natif, surface à l'écran : une région active", () => {
    const { calls: asked } = render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    expect(asked).toEqual([{ active: true, group: "player" }]);
  });

  it("contrôles masqués : la surface reste montée, sa région est retirée", () => {
    const { html, calls: asked } = render(
      <GlassChromeVisibleContext.Provider value={false}>
        <GlassSurface className="lgp-bar">x</GlassSurface>
      </GlassChromeVisibleContext.Provider>,
    );
    expect(html).toContain('data-lgp-present="false"');
    expect(asked).toEqual([{ active: false, group: "player" }]);
  });

  it("PiP : même habillage (rien ne se remonte), aucune région native", () => {
    const outside = render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    const inside = render(<GlassSurface className="lgp-bar">x</GlassSurface>, { inPip: true });
    expect(inside.html).toBe(outside.html);
    expect(inside.calls).toEqual([{ active: false, group: "player" }]);
  });

  it("surface fixe : fondu natif ; fenêtre en redimensionnement : aucune transition, le verre suit la barre", () => {
    expect(render(<GlassSurface className="lgp-bar">x</GlassSurface>).calls).toHaveLength(1);
    expect(transitions).toEqual([NATIVE_FADE_MS]);
    viewport.resizing = true;
    render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    expect(transitions).toEqual([0]);
  });

  it("à l'écran, aucune marque de sortie ; en sortie, la marque (les clics vont au bouton dessous)", () => {
    expect(render(<GlassSurface className="lgp-bar">x</GlassSurface>).html).not.toContain("data-lgp-exiting");
    presence.present = false;
    expect(render(<GlassSurface className="lgp-bar">x</GlassSurface>).html).toContain('data-lgp-exiting="true"');
  });

  it("contrôle qui se MATÉRIALISE : son propre conteneur (aucun groupe), la durée de son entrée, son geste à la coquille ET à la page", () => {
    const { html, calls: asked } = render(<GlassSurface className="lgp-group" materialize={2}>x</GlassSurface>);
    expect(asked).toEqual([{ active: true, group: undefined }]);
    expect(transitions).toEqual([MATERIALIZE.enterMs]);
    expect(materializes.at(-1)).toMatchObject({ rise: 6, scale: 0.96, delay: 80, exit: MATERIALIZE.exitMs });
    expect(html).toContain('data-lgp-materialize=""');
    // Les mêmes nombres, en variables pour la page.
    expect(html).toContain("--lgp-mat-delay:80ms");
    expect(html).toContain("--lgp-mat-rise:6px");
    expect(html).toContain("--lgp-mat-enter-ease:cubic-bezier(0.2, 0.9, 0.3, 1)");
  });

  it("masqué : sa région est retirée AU MASQUAGE — la coquille joue la sortie, puis la vue part", () => {
    const { html, calls: asked } = render(
      <GlassChromeVisibleContext.Provider value={false}>
        <GlassSurface className="lgp-group" materialize={0}>x</GlassSurface>
      </GlassChromeVisibleContext.Provider>,
    );
    expect(html).toContain('data-lgp-present="false"');
    expect(asked).toEqual([{ active: false, group: undefined }]);
  });

  it("mouvement réduit : un fondu simple — ni montée, ni échelle, ni décalage", () => {
    presence.reduced = true;
    const { html } = render(<GlassSurface className="lgp-group" materialize={3}>x</GlassSurface>);
    expect(materializes.at(-1)).toMatchObject({ rise: 0, scale: 1, delay: 20 });
    expect(transitions).toEqual([MATERIALIZE_REDUCED.enterMs]);
    expect(html).toContain("--lgp-mat-rise:0px");
  });

  it("une surface sans `materialize` ne change pas : groupe, fondu fixe, aucune variable", () => {
    const { html } = render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    expect(materializes.at(-1)).toBeUndefined();
    expect(html).not.toContain("data-lgp-materialize");
    expect(html).not.toContain("--lgp-mat");
  });

  it("ton du dessous : le verre clair le porte par défaut (son atténuation le suit), et le mesure tant qu'il est à l'écran", () => {
    expect(render(<GlassSurface className="lgp-bar">x</GlassSurface>).html).toContain('data-lg-tone="dark"');
    // Le verre normal s'adapte seul : ni mesure, ni atténuation.
    const regular = render(<GlassSurface className="lgp-panel" variant="regular">x</GlassSurface>).html;
    expect(regular).not.toContain("data-lg-tone");
    expect(regular).toContain('data-lgp-variant="regular"');
    expect(render(<GlassSurface className="lgp-bar" adaptiveTone={false}>x</GlassSurface>).html).not.toContain("data-lg-tone");
    backdrop.tone = "light";
    const shown = render(<GlassSurface className="lgp-group" adaptiveTone>x</GlassSurface>);
    expect(shown.html).toContain('data-lg-tone="light"');
    expect(backdrop.asked.at(-1)).toBe(true);
    render(
      <GlassChromeVisibleContext.Provider value={false}>
        <GlassSurface className="lgp-group" adaptiveTone>x</GlassSurface>
      </GlassChromeVisibleContext.Provider>,
    );
    // Masquée : plus de mesure (rien ne consomme), le ton retenu reste posé.
    expect(backdrop.asked.at(-1)).toBe(false);
  });

  it("sans verre natif (macOS < 26, réglage coupé) : aucune région", () => {
    native.available = false;
    const { calls: asked } = render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    expect(asked).toEqual([{ active: false, group: "player" }]);
  });
});
