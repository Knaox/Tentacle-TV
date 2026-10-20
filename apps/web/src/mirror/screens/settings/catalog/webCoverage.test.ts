import { describe, expect, it } from "vitest";
import {
  SETTINGS_CONTROLS, SETTINGS_SECTIONS, visibleSettingsSections, visibleSettingsGroups,
  type SettingsCatalogContext, type SettingsCatalogEntry,
} from "@tentacle-tv/shared";

import { CATALOG_ICONS } from "./catalogIcons";
import {
  WEB_ACTION_IDS, WEB_BLOCK_IDS, WEB_CONTROL_IDS, WEB_PANE_SEGMENTS, WEB_SCREEN_ROUTES, WEB_UNRENDERED,
  entryKey, parseSettingsSegment, webPaneRoute, webSectionRoute, webText,
} from "./webCatalog";

const has = (list: readonly string[], id: string) => list.includes(id);

function webRenders(entry: SettingsCatalogEntry): boolean {
  switch (entry.kind) {
    case "control": return has(WEB_CONTROL_IDS, entry.id);
    case "pane": return entry.id in WEB_PANE_SEGMENTS;
    case "screen": return entry.id in WEB_SCREEN_ROUTES;
    case "action": return has(WEB_ACTION_IDS, entry.id);
    case "block": return has(WEB_BLOCK_IDS, entry.id);
  }
}

const allEntries = SETTINGS_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.entries));

const base: SettingsCatalogContext = {
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
  bootIntro: false,
  abilities: new Set(["tickets", "manageAccount", "pairDevices", "push", "invites"]),
  profileSession: false,
};

describe("le web étroit rend le catalogue partagé des réglages", () => {
  it("chaque entrée est rendue par le web, OU réservée au mobile avec sa raison", () => {
    for (const entry of allEntries) {
      const key = entryKey(entry);
      const mobileOnly = entry.platforms !== undefined && !entry.platforms.includes("web");
      if (mobileOnly) {
        expect(WEB_UNRENDERED[key], `${key} : raison manquante dans WEB_UNRENDERED`).toSatisfy((reason: string | undefined) => (reason?.trim().length ?? 0) >= 20);
      } else {
        expect(WEB_UNRENDERED[key], `${key} : le catalogue le donne au web`).toBeUndefined();
        expect(webRenders(entry), `${key} : aucun composant web`).toBe(true);
      }
    }
  });

  it("le mobile rend tout le catalogue : aucune entrée ne l'exclut", () => {
    // Le mobile couvre chaque identifiant par un `switch` exhaustif (le type le tient) ;
    // il suffit qu'aucune entrée ne lui soit retirée.
    for (const entry of allEntries) {
      if (entry.platforms) expect(entry.platforms, entryKey(entry)).toContain("mobile");
    }
  });

  it("aucune exclusion du web ne vise une entrée qui n'existe plus", () => {
    const keys = new Set(allEntries.map(entryKey));
    for (const key of Object.keys(WEB_UNRENDERED)) expect(keys.has(key as never), key).toBe(true);
  });

  it("chaque réglage sur place a sa portée dans l'inventaire partagé", () => {
    for (const id of WEB_CONTROL_IDS) expect(SETTINGS_CONTROLS).toHaveProperty(id);
  });

  it("chaque icône du catalogue a son équivalent Lucide", () => {
    const icons = [
      ...SETTINGS_SECTIONS.map((section) => section.icon),
      ...allEntries.flatMap((entry) => ("icon" in entry ? [entry.icon] : [])),
    ];
    for (const icon of icons) expect(CATALOG_ICONS, icon).toHaveProperty(icon);
  });

  it("dans un navigateur, la rubrique Hors ligne disparaît ; Notifications aussi (push natif)", () => {
    const ids = visibleSettingsSections(base).map((section) => section.id);
    expect(ids).toEqual(["account", "playback", "devices", "help"]);
  });

  it("session de profil : ni mot de passe, ni TV et appareils", () => {
    const ids = visibleSettingsSections({ ...base, profileSession: true }).map((section) => section.id);
    expect(ids).not.toContain("devices");
    const account = SETTINGS_SECTIONS.find((section) => section.id === "account")!;
    const shown = visibleSettingsGroups(account, { ...base, profileSession: true }).flatMap((g) => g.entries.map(entryKey));
    expect(shown).not.toContain("pane:password");
  });

  it("les phrases écrites pour le téléphone ont leur version web", () => {
    expect(webText({ ns: "settingsMobile", key: "playback.everywhereCaption" }).key).toBe("web.everywhereCaption");
    expect(webText({ ns: "profile", key: "stats" }).key).toBe("stats");
  });

  it("routes : volets, rubriques et anciennes pages", () => {
    expect(webPaneRoute("mediaLanguages")).toBe("/settings/media-languages");
    expect(webSectionRoute("playback", "personalization")).toBe("/profile/playback?pane=personalization");
    expect(parseSettingsSegment("media-languages")).toEqual({ kind: "pane", id: "mediaLanguages" });
    expect(parseSettingsSegment("security")).toEqual({ kind: "pane", id: "password" });
    expect(parseSettingsSegment("playback")).toEqual({ kind: "section", id: "playback" });
    expect(parseSettingsSegment("data")).toEqual({ kind: "section", id: "playback" });
    expect(parseSettingsSegment("family")).toEqual({ kind: "family" });
    expect(parseSettingsSegment("nimporte")).toEqual({ kind: "profile" });
    expect(parseSettingsSegment(undefined)).toEqual({ kind: "profile" });
  });
});
