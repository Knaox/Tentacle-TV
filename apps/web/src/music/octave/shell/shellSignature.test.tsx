import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Octave — on sait qu'on est dans Tentacle : la marque est signée
 * « Tentacle » (lue « Octave, le mode musique de Tentacle »), et sous la
 * bascule « Mode musique » le retour aux films est dit en toutes lettres.
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../mode/OctaveModeSwitch", () => ({
  OctaveModeSwitch: ({ showLabel }: { showLabel?: boolean }) => <button role="switch">{showLabel ? "mode.switchLabel" : null}</button>,
}));
vi.mock("./OctaveFirstVisitHint", () => ({ OctaveFirstVisitHint: () => null }));

const { OctaveWordmark } = await import("./OctaveWordmark");
const { OctaveModeSlot } = await import("./OctaveModeSlot");

describe("la signature de Tentacle", () => {
  it("la marque porte « Tentacle » sous « Octave », et se lit d'un bloc", () => {
    const html = renderToStaticMarkup(<OctaveWordmark />);
    expect(html).toContain('aria-label="signature.label"');
    expect(html).toMatch(/>Octave<\/span>/);
    expect(html).toContain(">signature.of<");
    // Le logo : la mascotte et son tricorne (module généré), jamais un fichier.
    expect(html).toContain("data:image/svg+xml");
  });

  it("bureau : la bascule « Mode musique », puis « Films et séries » qui ramène aux films", () => {
    const onExit = vi.fn();
    const html = renderToStaticMarkup(<OctaveModeSlot onExit={onExit} />);
    expect(html.indexOf("mode.switchLabel")).toBeLessThan(html.indexOf("backToFilms.label"));
    expect(html).toContain('title="backToFilms.hint"');
    expect(html).toContain("data-octave-back-to-films");
  });

  it("fenêtre étroite : l'interrupteur seul", () => {
    const html = renderToStaticMarkup(<OctaveModeSlot onExit={() => undefined} compact />);
    expect(html).toContain('role="switch"');
    expect(html).not.toContain("backToFilms.label");
  });
});
