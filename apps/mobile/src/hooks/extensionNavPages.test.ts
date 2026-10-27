import { describe, expect, it } from "vitest";
import { mobilePluginNavPages, mobilePluginRoutes } from "./extensionNavPages";

const PAGE = { path: "/x/page", icon: "clock", platforms: ["mobile", "web"], labels: { fr: "Page" } };
const OTHER = { path: "/x/autre", icon: "list", platforms: ["mobile"], labels: { fr: "Autre" } };
const WEB = { path: "/x/web", icon: "list", platforms: ["web"], labels: { fr: "Web" } };

describe("pages mobiles d'une extension : routes et sections", () => {
  it("serveur d'avant (aucun `hidden`) : les mêmes pages, comme avant", () => {
    expect(mobilePluginRoutes([PAGE, OTHER, WEB])).toEqual([PAGE, OTHER]);
    expect(mobilePluginNavPages([PAGE, OTHER, WEB])).toEqual([PAGE, OTHER]);
    expect(mobilePluginNavPages(undefined)).toEqual([]);
  });

  it("page masquée : plus de section, mais sa route s'ouvre encore par un lien", () => {
    const hidden = { ...PAGE, hidden: true };
    expect(mobilePluginRoutes([hidden, OTHER])).toEqual([hidden, OTHER]);
    expect(mobilePluginNavPages([hidden, OTHER])).toEqual([OTHER]);
    // Seule page de l'extension, masquée : aucune section, l'onglet se masque.
    expect(mobilePluginNavPages([hidden])).toEqual([]);
  });

  it("seul `true` masque", () => {
    expect(mobilePluginNavPages([{ ...PAGE, hidden: "true" }])).toHaveLength(1);
    expect(mobilePluginNavPages([{ ...PAGE, hidden: false }])).toHaveLength(1);
  });
});
