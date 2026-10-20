import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SETTINGS_SECTIONS, type SettingsCatalogContext } from "@tentacle-tv/shared";

/**
 * Le rendu web du catalogue, monté pour de vrai (sans navigateur) : la liste
 * des rubriques et une page, dans le contexte d'un navigateur. `t()` rend la
 * clé : on lit quelles entrées sont dessinées.
 */

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
vi.mock("../../../../theme/useThemeMode", () => ({ useThemeMode: () => ({ mode: "dark", setMode: vi.fn() }) }));
// Les composants qui parlent au serveur sont remplacés : seul l'aiguillage du catalogue est éprouvé.
vi.mock("./webControlRegistry", () => ({
  WEB_CONTROL_RENDERERS: new Proxy({}, { get: (_target, id) => () => <span>{`control:${String(id)}`}</span> }),
}));
vi.mock("../../profile/AdminSessionsRow", () => ({ AdminSessionsRow: () => <span>screen:sessions</span> }));
vi.mock("../../../../family/useFamilyAvailability", () => ({ useFamilySettingsAvailability: () => ({ available: false, settled: true }) }));
vi.mock("@tentacle-tv/api-client", () => ({ useFamilyOverview: () => ({ data: undefined }) }));

const { CatalogSectionList } = await import("./CatalogSectionList");
const { CatalogSectionBody } = await import("./CatalogSectionBody");

const web: SettingsCatalogContext = {
  platform: "web",
  capabilities: new Set(),
  offline: false,
  isAdmin: false,
  offlineVisible: false,
  canGoOffline: false,
  family: false,
  canSwitchProfile: false,
  liquidGlass: false,
  advancedEngine: false,
  engineOptions: false,
  liveTransfers: false,
  profileSession: false,
};

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("rendu web du catalogue des réglages", () => {
  it("la liste montre les rubriques du web, dans l'ordre, et pas celles du mobile", () => {
    const html = render(<CatalogSectionList ctx={web} />);
    const order = ["sections.account", "sections.playback", "sections.tv", "sections.help"].map((key) => html.indexOf(key));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain("sections.offline");
    expect(html).not.toContain("sections.notifications");
  });

  it("la page Aide dessine support, à propos, confidentialité et le renvoi au bureau", () => {
    const help = SETTINGS_SECTIONS.find((section) => section.id === "help")!;
    const html = render(<CatalogSectionBody section={help} ctx={web} />);
    for (const key of ["support", "about", "privacyPolicy", "control:advancedOnDesktop"]) expect(html).toContain(key);
  });
});
