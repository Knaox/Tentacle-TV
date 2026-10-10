import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Une lecture lancée pendant le PiP s'y charge : la vue de chargement couvre
 * le noir de mpv, et l'habillage n'offre plus que revenir et fermer — rien à
 * mettre en pause ni à sauter tant qu'il n'y a pas d'image.
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { PipLoadingView } = await import("./PipLoadingView");
const { PipOverlay } = await import("./PipOverlay");

const noop = () => undefined;

describe("PipLoadingView", () => {
  it("annonce le chargement, avec le titre et l'image de ce qui arrive, sur un fond opaque", () => {
    const html = renderToStaticMarkup(
      <PipLoadingView loading={{ posterUrl: "https://x/backdrop.jpg", title: "Dune · Partie deux" }} leaving={false} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("loading");
    expect(html).toContain("Dune · Partie deux");
    expect(html).toContain('src="https://x/backdrop.jpg"');
    expect(html).toContain("bg-[#0a0a12]");
    expect(html).toContain("opacity-100");
  });

  it("s'efface en fondu quand l'image arrive", () => {
    const html = renderToStaticMarkup(<PipLoadingView loading={{ title: "Dune" }} leaving />);
    expect(html).toContain("opacity-0");
    expect(html).not.toContain("<img");
  });
});

describe("PipOverlay pendant un chargement", () => {
  it("garde revenir et fermer, jamais lecture, sauts ni progression", () => {
    const props = { visible: true, paused: false, position: 0, duration: 0, title: "Dune", onTogglePause: noop, onSkip: noop };
    const playing = renderToStaticMarkup(<PipOverlay {...props} />);
    const loading = renderToStaticMarkup(<PipOverlay {...props} loading />);
    expect(playing).toContain("pip.back10");
    expect(loading).toContain("pip.expand");
    expect(loading).toContain("pip.close");
    expect(loading).not.toContain("pip.back10");
    expect(loading).not.toContain("pip.pause");
    expect(loading).not.toContain("scaleX(");
  });
});
