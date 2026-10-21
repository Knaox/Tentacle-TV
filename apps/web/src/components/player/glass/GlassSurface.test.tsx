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
const native = vi.hoisted(() => ({ available: true }));
vi.mock("./nativeGlassPort", () => ({
  useNativeGlassAvailable: () => native.available,
  videoUnderWindow: () => true,
  useNativeGlassRegion: (_ref: unknown, options: { active: boolean; group: string }) => {
    calls.push({ active: options.active, group: options.group });
  },
}));
vi.mock("framer-motion", () => ({ useIsPresent: () => true }));

const { GlassSurface, GlassChromeVisibleContext } = await import("./GlassSurface");
const { PlayerGlassProvider } = await import("./PlayerGlassContext");
const { PictureInPictureContext } = await import("../../../pictureInPicture/pictureInPictureContext");

const pip = (active: boolean) => ({ supported: true, active }) as never;

function render(node: ReactNode, { inPip = false } = {}) {
  calls.length = 0;
  const html = renderToStaticMarkup(
    <PictureInPictureContext.Provider value={pip(inPip)}>
      <PlayerGlassProvider>{node}</PlayerGlassProvider>
    </PictureInPictureContext.Provider>,
  );
  return { html, calls: [...calls] };
}

describe("les régions natives du lecteur", () => {
  beforeEach(() => { native.available = true; });

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

  it("sans verre natif (macOS < 26, réglage coupé) : aucune région", () => {
    native.available = false;
    const { calls: asked } = render(<GlassSurface className="lgp-bar">x</GlassSurface>);
    expect(asked).toEqual([{ active: false, group: "player" }]);
  });
});
