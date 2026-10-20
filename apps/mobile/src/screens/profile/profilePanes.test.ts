import { describe, expect, it } from "vitest";
import { findSettingsSection, SETTINGS_PANE_SCOPES, SETTINGS_SECTIONS } from "@tentacle-tv/shared";
import { FAMILY_ROUTE } from "../../../../../packages/api-client/src/utils/notificationRoute";
import { FAMILY_HREF, LEGACY_PANE_REDIRECTS, PROFILE_PANE_ROUTES, SETTINGS_SCREEN_ROUTES } from "./profilePanes";

const allEntries = SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

describe("routes du mobile pour le catalogue des réglages", () => {
  it("chaque volet du catalogue a sa route", () => {
    expect(Object.keys(PROFILE_PANE_ROUTES).sort()).toEqual(Object.keys(SETTINGS_PANE_SCOPES).sort());
  });

  it("chaque écran du catalogue a sa route, et les anciennes destinations restent atteignables", () => {
    for (const entry of allEntries) if (entry.kind === "screen") expect(SETTINGS_SCREEN_ROUTES[entry.id]).toBeDefined();
    for (const route of ["/support", "/about", "/on-device", "/admin/sessions"]) {
      expect(Object.values(SETTINGS_SCREEN_ROUTES)).toContain(route);
    }
  });

  it("l'Aide du mobile n'offre plus le guide des bandes-annonces", () => {
    expect(Object.values(SETTINGS_SCREEN_ROUTES).some((route) => route.startsWith("/help/trailers"))).toBe(false);
  });

  it("les volets fondus redirigent vers une rubrique qui existe", () => {
    for (const target of Object.values(LEGACY_PANE_REDIRECTS)) {
      expect(findSettingsSection(target.replace("/profile/", ""))).toBeDefined();
    }
  });

  it("la Famille ouvre l'écran des notifications Famille", () => {
    expect(FAMILY_HREF).toBe(FAMILY_ROUTE);
  });
});
