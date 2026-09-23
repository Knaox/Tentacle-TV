import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * La sortie de l'attente, tenue d'un bout à l'autre sur le bureau : page
 * d'attente, préparation de mpv, puis ouverture du flux et réserve. La pilule
 * n'était que sur la première — dès que le lecteur se montait, elle
 * disparaissait, et l'attente du serveur n'avait plus de bouton à l'écran.
 *
 * Rendu statique, comme les autres bancs de composants : on prouve la
 * présence, l'absence et la place dans l'arbre, pas le clic. `t()` rend la
 * clé ; l'api-client et l'arbitre sont remplacés (chargés en vrai, ils tirent
 * une seconde copie de React).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tentacle-tv/api-client", () => ({ useEndCardRating: () => null }));
vi.mock("./PlaybackOverlay", () => ({ PlaybackOverlay: () => null }));

const { LoadingBackButton, PlayerLoadingScreen } = await import("./PlayerLoadingScreen");
const { DesktopPlayerLoading } = await import("./DesktopPlayerFallback");
const { DesktopPlayerOverlays } = await import("./DesktopPlayerOverlays");

const noop = () => undefined;
const PILL = renderToStaticMarkup(<LoadingBackButton onClick={noop} />);

const overlays = (showLoadingOverlay: boolean) =>
  renderToStaticMarkup(
    <DesktopPlayerOverlays
      showLoadingOverlay={showLoadingOverlay} onBack={noop}
      buffering={false} buffered={0} posterUrl="/affiche.jpg"
      overlay={{ kind: "none" }} countdownTotals={{ skipMs: 0, nextMs: 0 }}
      onSkip={noop} onDismissOverlay={noop} onPlayNow={noop}
      controlsVisible={false} panelOpen={false}
    />,
  );

describe("la sortie des écrans de chargement du bureau", () => {
  it("est la même pilule sur la page d'attente et pendant la préparation de mpv", () => {
    expect(PILL).toContain('aria-label="player:back"');
    expect(renderToStaticMarkup(<PlayerLoadingScreen onCancel={noop} />)).toContain(PILL);
    expect(renderToStaticMarkup(<DesktopPlayerLoading onBack={noop} />)).toContain(PILL);
  });

  it("reste pendant l'ouverture du flux, au-dessus de l'habillage", () => {
    const html = overlays(true);
    // Dernière de la liste, donc HORS de la couche de chargement : son
    // `z-[5]` est un contexte d'empilement, la pilule y passerait sous
    // l'habillage (`z-10`), qui prend les clics même effacé.
    expect(html.endsWith(PILL)).toBe(true);
    expect(PILL).toMatch(/\bz-20\b/);
  });

  it("s'en va avec l'écran de chargement : l'habillage reprend sa sortie", () => {
    expect(overlays(false)).not.toContain("player:back");
  });
});
