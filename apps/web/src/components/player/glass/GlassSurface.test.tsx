import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Quand une surface du lecteur demande-t-elle une région de verre NATIVE ?
 * Seulement verre natif + surface à l'écran + hors PiP. La couture vers les
 * socles (`nativeGlassPort`) est remplacée : on lit ce que chaque surface lui
 * demande, au rendu.
 */

const calls = vi.hoisted(() => [] as Array<{ active: boolean; group: string }>);
const transitions = vi.hoisted(() => [] as number[]);
const native = vi.hoisted(() => ({ available: true }));
const viewport = vi.hoisted(() => ({ resizing: false }));
const backdrop = vi.hoisted(() => ({ tone: "dark" as "dark" | "light", asked: [] as boolean[] }));
vi.mock("./nativeGlassPort", () => ({
  useNativeGlassAvailable: () => native.available,
  videoUnderWindow: () => true,
  useNativeGlassRegion: (_ref: unknown, options: { active: boolean; group: string; transition: number }) => {
    calls.push({ active: options.active, group: options.group });
    transitions.push(options.transition);
  },
  useVideoBackdropTone: (_element: unknown, active: boolean) => {
    backdrop.asked.push(active);
    return backdrop.tone;
  },
}));
vi.mock("./windowResizing", () => ({ useWindowResizing: () => viewport.resizing }));
const presence = vi.hoisted(() => ({ present: true, reduced: false }));
vi.mock("framer-motion", () => ({ useIsPresent: () => presence.present, useReducedMotion: () => presence.reduced }));

const { GlassSurface, GlassChromeVisibleContext, NATIVE_FADE_MS } = await import("./GlassSurface");
const { PlayerGlassProvider } = await import("./PlayerGlassContext");
const { PictureInPictureContext } = await import("../../../pictureInPicture/pictureInPictureContext");

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

  it("contrôle qui se REPLIE : masqué, sa région reste demandée (la fin du repli, `visibility`, la retire), suivie image par image", () => {
    const { html, calls: asked } = render(
      <GlassChromeVisibleContext.Provider value={false}>
        <GlassSurface className="lgp-group" collapse>x</GlassSurface>
      </GlassChromeVisibleContext.Provider>,
    );
    expect(html).toContain('data-lgp-present="false"');
    expect(html).toContain('data-lgp-collapse=""');
    expect(asked).toEqual([{ active: true, group: "player" }]);
    expect(transitions).toEqual([0]);
  });

  it("mouvement réduit : pas de repli suivi — la région part et revient en fondu natif", () => {
    presence.reduced = true;
    render(<GlassSurface className="lgp-group" collapse>x</GlassSurface>);
    expect(transitions).toEqual([NATIVE_FADE_MS]);
  });

  it("ton du dessous : seule une forme ADAPTATIVE le porte, et le mesure tant qu'elle est à l'écran", () => {
    expect(render(<GlassSurface className="lgp-bar">x</GlassSurface>).html).not.toContain("data-lg-tone");
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
