import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * L'écran « Licences » du web et du bureau, rendu à plat : la mention de
 * l'AGPL et la source de CETTE version, les composants de la plateforme (et
 * ceux du serveur sur le web), puis la liste des textes. `t()` rend la clé.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: { count?: number; version?: string }) => `${key}${o?.count ?? ""}${o?.version ?? ""}` }),
}));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("../ui/ModalHeader", () => ({ ModalHeader: () => null }));
vi.mock("../../lib/openExternal", () => ({ externalLinkHandler: () => undefined }));

const { LicensesSection } = await import("./LicensesSection");

describe("LicensesSection", () => {
  it("macOS : la chaîne mpv LGPL du Mac App Store, la source au tag du bureau", () => {
    const html = renderToStaticMarkup(<LicensesSection platform="macos" version="1.27.0" />);
    expect(html).toContain("about:tentacleLicense1.27.0");
    expect(html).toContain("https://github.com/Knaox/Tentacle-TV/tree/desktop-v1.27.0");
    expect(html).toContain("mpv (libmpv)");
    expect(html).toContain("Electron");
    expect(html).toContain("GNU Affero General Public License v3.0");
    expect(html).not.toContain("Chromaprint");
  });

  it("web : les composants du serveur qui le sert, et leurs textes", () => {
    const html = renderToStaticMarkup(<LicensesSection platform="web" version="1.24.0" />);
    expect(html).toContain("Chromaprint (fpcalc program)");
    expect(html).toContain("The Unlicense");
    expect(html).toContain("server-v1.24.0");
    expect(html).not.toContain("Electron");
  });

  it("webOS : ni Electron ni serveur, les polyfills du client LG", () => {
    const html = renderToStaticMarkup(<LicensesSection platform="webos" version="1.0.0" />);
    expect(html).toContain("core-js");
    expect(html).not.toContain("Electron");
    expect(html).not.toContain("Chromaprint");
  });
});
