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
    for (const type of ["ticket_new", "ticket_user_reply"]) {
      expect(resolveNotificationRoute({ type, refId: "t1" }, "web")).toBe("/admin/tickets?ticketId=t1");
      expect(resolveNotificationRoute({ type, refId: null }, "web")).toBe("/admin/tickets");
      expect(resolveNotificationRoute({ type, refId: "t1" }, "mobile")).toBe("/support?ticketId=t1");
    }
  });

  it("un type inconnu n'a pas de route", () => {
    expect(resolveNotificationRoute({ type: "mystery", refId: "x" }, "web")).toBeNull();
  });
});
