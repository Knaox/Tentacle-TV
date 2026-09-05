import { describe, expect, it } from "vitest";
import { resolveNotificationRoute } from "./notificationRoute";

describe("resolveNotificationRoute — tickets", () => {
  it("l'auteur atterrit sur sa page de support, fiche ouverte", () => {
    for (const type of ["ticket_reply", "ticket_status"]) {
      expect(resolveNotificationRoute({ type, refId: "t1" }, "web")).toBe("/support?ticketId=t1");
      expect(resolveNotificationRoute({ type, refId: "t1" }, "mobile")).toBe("/support?ticketId=t1");
      expect(resolveNotificationRoute({ type, refId: null }, "web")).toBe("/support");
    }
  });

  it("l'admin atterrit sur la page admin du web, sur l'écran unique du mobile", () => {
    for (const type of ["ticket_new", "ticket_user_reply", "ticket_user_closed"]) {
      expect(resolveNotificationRoute({ type, refId: "t1" }, "web")).toBe("/admin/tickets?ticketId=t1");
      expect(resolveNotificationRoute({ type, refId: null }, "web")).toBe("/admin/tickets");
      expect(resolveNotificationRoute({ type, refId: "t1" }, "mobile")).toBe("/support?ticketId=t1");
    }
  });

  it("un type inconnu n'a pas de route", () => {
    expect(resolveNotificationRoute({ type: "mystery", refId: "x" }, "web")).toBeNull();
  });
});

const VIGIE = {
  pluginId: "seer",
  navItems: [
    { path: "/discover", platforms: ["web", "desktop", "mobile"] },
    { path: "/requests", platforms: ["web", "desktop", "mobile"] },
    { path: "/releases", platforms: ["web", "desktop", "mobile"] },
    { path: "/admin/plugins/seer", platforms: ["web"] },
  ],
};

describe("resolveNotificationRoute — demandes (request_status)", () => {
  it("sur mobile, ouvre la section Mes demandes de l'onglet des extensions", () => {
    expect(resolveNotificationRoute({ type: "request_status", refId: "r1" }, "mobile", [VIGIE]))
      .toBe("/extensions?section=seer%3A%2Frequests");
  });

  it("préfère la page des demandes même listée après les autres", () => {
    const plugin = { pluginId: "seer", navItems: [...VIGIE.navItems].reverse() };
    expect(resolveNotificationRoute({ type: "request_status", refId: null }, "mobile", [plugin]))
      .toBe("/extensions?section=seer%3A%2Frequests");
    expect(resolveNotificationRoute({ type: "request_status", refId: null }, "web", [plugin]))
      .toBe("/requests");
  });

  it("retombe sur la première page de la plateforme sans page des demandes", () => {
    const plugin = { pluginId: "other", navItems: [{ path: "/home", platforms: ["mobile"] }, { path: "/more", platforms: ["mobile"] }] };
    expect(resolveNotificationRoute({ type: "request_status", refId: null }, "mobile", [plugin]))
      .toBe("/extensions?section=other%3A%2Fhome");
  });

  it("ignore un plugin sans page pour la plateforme", () => {
    const webOnly = { pluginId: "webonly", navItems: [{ path: "/panel", platforms: ["web"] }] };
    expect(resolveNotificationRoute({ type: "request_status", refId: null }, "mobile", [webOnly, VIGIE]))
      .toBe("/extensions?section=seer%3A%2Frequests");
    expect(resolveNotificationRoute({ type: "request_status", refId: null }, "mobile", [webOnly])).toBeNull();
  });

  it("sur le web, ouvre la page des demandes du plugin", () => {
    expect(resolveNotificationRoute({ type: "request_status", refId: "r1" }, "web", [VIGIE])).toBe("/requests");
  });

  it("sans métadonnées de plugin, pas de route", () => {
    expect(resolveNotificationRoute({ type: "request_status", refId: "r1" }, "mobile")).toBeNull();
    expect(resolveNotificationRoute({ type: "request_status", refId: "r1" }, "web", [])).toBeNull();
  });
});
