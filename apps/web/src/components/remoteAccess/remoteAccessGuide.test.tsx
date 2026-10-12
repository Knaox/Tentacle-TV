import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le guide de l'accès à distance : l'app Windows n'entend parler ni de Docker
 * Desktop ni de la pile Docker ; un serveur qui ne dit rien de sa livraison
 * garde le guide d'avant. `t()` rend la clé.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { RemoteAccessGuide } = await import("./RemoteAccessGuide");

describe("le guide de l'accès à distance", () => {
  it("l'app Windows : l'avertissement Docker Desktop se tait, le mandataire est dit sans pile Docker", () => {
    const out = renderToStaticMarkup(<RemoteAccessGuide packaging="windows-app" />);
    expect(out).not.toContain("ports_p4");
    expect(out).toContain("choose_p2_windowsApp");
    expect(out).toContain(">ports_p3<");
  });

  it("un serveur qui ne dit rien de sa livraison : le guide d'avant", () => {
    const out = renderToStaticMarkup(<RemoteAccessGuide />);
    expect(out).toContain(">ports_p4<");
    expect(out).toContain(">choose_p2<");
    expect(out).not.toContain("_windowsApp");
  });
});
