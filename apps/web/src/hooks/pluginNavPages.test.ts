import { describe, expect, it } from "vitest";
import { webPluginNavPages, webPluginRoutes } from "./pluginNavPages";
import { isPluginNavPinnedBy } from "./pluginNavPins";

const PAGE = { path: "/x/page", icon: "clock", platforms: ["web", "desktop"] };
const OTHER = { path: "/x/autre", icon: "list", platforms: ["web"] };
const ADMIN = { path: "/admin/plugins/x", icon: "settings", admin: true, platforms: ["web"] };
const MOBILE = { path: "/x/mobile", icon: "list", platforms: ["mobile"] };

const plugin = (navItems: Array<Record<string, unknown> & { path: string }>, configEnabled = true) => ({ configEnabled, navItems });

describe("pages d'extension sur le web : routes et navigation", () => {
  it("serveur d'avant (aucun `hidden`) : les deux listes sont les mêmes, comme avant", () => {
    const ext = plugin([PAGE, OTHER, ADMIN, MOBILE]);
    expect(webPluginRoutes(ext)).toEqual([PAGE, OTHER]);
    expect(webPluginNavPages(ext)).toEqual([PAGE, OTHER]);
  });

  it("page masquée : sa route reste, elle sort de la navigation", () => {
    const hidden = { ...PAGE, primary: false, hidden: true };
    const ext = plugin([hidden, OTHER, ADMIN]);
    expect(webPluginRoutes(ext)).toEqual([hidden, OTHER]);
    expect(webPluginNavPages(ext)).toEqual([OTHER]);
  });

  it("seul `true` masque : un `hidden` mal formé laisse la page dans la navigation", () => {
    const odd = { ...PAGE, hidden: "true" };
    expect(webPluginNavPages(plugin([odd]))).toEqual([odd]);
    expect(webPluginNavPages(plugin([{ ...PAGE, hidden: false }]))).toHaveLength(1);
  });

  it("une épingle d'appareil d'avant ne ramène pas une page masquée", () => {
    const hidden = { ...PAGE, primary: true, hidden: true };
    // L'appareil la tenait pour épinglée (aucun retrait, et l'ancienne liste `pluginsPinned`) : rien n'y fait.
    const pins = { pluginsUnpinned: [], pluginsPinned: ["x:/x/page"] };
    expect(isPluginNavPinnedBy(pins, "x:/x/page", hidden.primary)).toBe(true);
    expect(webPluginNavPages(plugin([hidden]))).toEqual([]);
  });

  it("extension non configurée : ni route, ni navigation", () => {
    const ext = plugin([PAGE, OTHER], false);
    expect(webPluginRoutes(ext)).toEqual([]);
    expect(webPluginNavPages(ext)).toEqual([]);
    expect(webPluginRoutes({ navItems: [PAGE] })).toEqual([]);
  });
});
