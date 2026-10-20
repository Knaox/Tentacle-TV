import { describe, expect, it } from "vitest";
import frNav from "../i18n/locales/fr/nav";
import enNav from "../i18n/locales/en/nav";
import frOffline from "../i18n/locales/fr/offline";
import enOffline from "../i18n/locales/en/offline";
import frProfile from "../i18n/locales/fr/profile";
import enProfile from "../i18n/locales/en/profile";
import frSessions from "../i18n/locales/fr/sessions";
import enSessions from "../i18n/locales/en/sessions";
import frSettings from "../i18n/locales/fr/settingsMobile";
import enSettings from "../i18n/locales/en/settingsMobile";
import { SETTINGS_SECTIONS } from "./settingsSections";
import {
  findSettingsSection as findSection, resolveSettingsSection as resolveSection, settingsSectionSummary as sectionSummary,
  settingsSectionTarget as sectionTarget, visibleSettingsGroups as visibleGroups, visibleSettingsSections as visibleSections,
} from "./settingsCatalogRules";
import type {
  SettingsCatalogContext as ProfileContext, SettingsControlId as ProfileControlId, SettingsCatalogEntry as ProfileEntry,
  SettingsI18nRef as I18nRef, SettingsCatalogSection as ProfileSection,
} from "./settingsCatalogTypes";
import { DESKTOP_ONLY_SETTINGS, SETTINGS_CONTROLS, SETTINGS_PANE_SCOPES as PANE_SCOPES, settingScopeOf } from "./settingsControls";

const ALL_CAPS = new Set(["playback.stillWatching", "reco.trending"] as const);
const ALL_ABILITIES = new Set(["tickets", "manageAccount", "pairDevices", "push", "invites"] as const);
const user: ProfileContext = {
  platform: "mobile", capabilities: new Set(), abilities: ALL_ABILITIES,
  offline: false, isAdmin: false, offlineVisible: false, canGoOffline: false, family: false, canSwitchProfile: false,
  liquidGlass: false, advancedEngine: false, engineOptions: false, bootIntro: false, liveTransfers: false, profileSession: false,
};
const full: ProfileContext = {
  ...user, isAdmin: true, offlineVisible: true, canGoOffline: true, family: true, canSwitchProfile: true,
  liquidGlass: true, advancedEngine: true, engineOptions: true, bootIntro: true, liveTransfers: true, capabilities: ALL_CAPS,
};
const web: ProfileContext = { ...full, platform: "web", liquidGlass: false, advancedEngine: false, engineOptions: false };
const offline: ProfileContext = { ...full, offline: true };
const profileSession: ProfileContext = { ...full, isAdmin: false, profileSession: true };

const entries = (section: ProfileSection, ctx: ProfileContext): ProfileEntry[] =>
  visibleGroups(section, ctx).flatMap((g) => g.entries);
const ids = (section: ProfileSection, ctx: ProfileContext) => entries(section, ctx).map((e) => e.id);
const section = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id)!;
const allEntries = SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

describe("catalogue des réglages", () => {
  it("six rubriques, dans l'ordre du plan", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual(["account", "playback", "devices", "offline", "notifications", "help"]);
  });

  it("chaque volet est rangé une fois, et une seule", () => {
    const panes = allEntries.filter((e) => e.kind === "pane").map((e) => e.id);
    expect([...panes].sort()).toEqual(Object.keys(PANE_SCOPES).sort());
  });

  it("chaque entrée est unique, sauf le renvoi vers le bureau (Lecture ET Aide)", () => {
    const all = allEntries.map((e) => `${e.kind}:${e.id}`).filter((key) => key !== "control:advancedOnDesktop");
    expect(new Set(all).size).toBe(all.length);
    expect(allEntries.filter((e) => e.id === "advancedOnDesktop")).toHaveLength(2);
  });

  it("les rubriques d'avant (Apparence, Serveur) mènent à celle qui les a recueillies", () => {
    expect(findSection("appearance")?.id).toBe("playback");
    expect(findSection("server")?.id).toBe("account");
    expect(findSection("inconnue")).toBeUndefined();
  });

  it("hors ligne, il ne reste que ce qui vit sur l'appareil", () => {
    expect(visibleSections(offline).map((s) => s.id)).toEqual(["playback", "offline", "help"]);
    expect(ids(section("offline"), offline)).toEqual([
      "offlineTitles", "offlineSpace", "wifiOnly", "backgroundTransfers", "notifyReady", "liveTransfers", "removeAllOffline",
    ]);
    expect(ids(section("help"), offline)).toEqual(["about", "privacyPolicy", "advancedOnDesktop"]);
    expect(ids(section("playback"), offline)).not.toContain("personalization");
    expect(ids(section("playback"), offline)).not.toContain("trendingNow");
  });

  it("en ligne, sans droit au hors ligne, la rubrique Hors ligne disparaît", () => {
    expect(visibleSections(user).map((s) => s.id)).toEqual(["account", "playback", "devices", "notifications", "help"]);
  });

  it("Lecture et apparence : le compte d'abord, l'appareil ensuite, le renvoi au bureau en dernier", () => {
    expect(ids(section("playback"), full)).toEqual([
      "scopeIntro",
      "intros", "nextAutoPlay", "stillWatching", "mediaLanguages", "language", "personalization", "trendingNow",
      "theme", "liquidGlass", "subtitleSize", "subtitlePosition", "dataSaver", "engine", "engineOptions",
      "bootIntro", "bootSound",
      "advancedOnDesktop",
    ]);
  });

  it("ce que le serveur ou la build ne savent pas faire n'a pas de ligne", () => {
    const shown = ids(section("playback"), user);
    for (const id of ["stillWatching", "trendingNow", "liquidGlass", "subtitleSize", "subtitlePosition", "engine", "engineOptions"]) {
      expect(shown).not.toContain(id);
    }
    expect(shown).toEqual(expect.arrayContaining(["intros", "nextAutoPlay", "language", "theme", "dataSaver"]));
  });

  it("Compte : invitations et sessions réservées à un administrateur", () => {
    expect(ids(section("account"), user)).toEqual(["photo", "userName", "password", "changeServer", "clearCache", "deleteAccount"]);
    expect(ids(section("account"), full)).toEqual([
      "photo", "userName", "password", "family", "switchProfile", "askAtLaunch", "changeServer", "invites", "sessions", "clearCache", "deleteAccount",
    ]);
    expect(sectionSummary(section("account"), full)?.key).toBe("sections.accountSummaryFamily");
  });

  it("« Changer de profil » exige une famille d'au moins deux profils", () => {
    expect(ids(section("account"), { ...full, canSwitchProfile: false })).not.toContain("switchProfile");
    expect(ids(section("account"), { ...full, canSwitchProfile: false })).not.toContain("askAtLaunch");
  });

  it("« Qui regarde ? » au démarrage : absent si l'administration ne le propose pas d'office", () => {
    expect(ids(section("account"), { ...full, launchAsked: false })).not.toContain("askAtLaunch");
    expect(ids(section("account"), { ...full, launchAsked: false })).toContain("switchProfile");
  });

  it("en session de profil, rien de ce que le serveur refuse", () => {
    expect(ids(section("account"), profileSession)).toEqual(["photo", "userName", "switchProfile", "clearCache"]);
    const sections = visibleSections(profileSession).map((s) => s.id);
    expect(sections).toEqual(["account", "playback", "help"]);
  });

  it("une rubrique d'un seul volet ouvre ce volet, les autres leur page", () => {
    expect(sectionTarget(section("notifications"), user)).toEqual({ kind: "pane", id: "notifications" });
    expect(sectionTarget(section("devices"), user)).toEqual({ kind: "pane", id: "devices" });
    expect(sectionTarget(section("account"), user)).toEqual({ kind: "page" });
  });

  it("la tablette garde la rubrique choisie tant qu'elle existe", () => {
    expect(resolveSection(null, user)).toBe("account");
    expect(resolveSection("devices", user)).toBe("devices");
    expect(resolveSection("devices", offline)).toBe("playback");
  });
});

describe("droits de la session (rien d'affiché sans le droit)", () => {
  it("un invité de la Famille sans droits ne voit ni support, ni compte, ni jumelage, ni push, ni invitations", () => {
    const guest: ProfileContext = { ...full, abilities: new Set() };
    expect(ids(section("account"), guest)).not.toEqual(expect.arrayContaining(["password"]));
    expect(ids(section("account"), guest)).not.toContain("deleteAccount");
    expect(ids(section("account"), guest)).not.toContain("invites");
    expect(ids(section("help"), guest)).not.toContain("support");
    expect(visibleSections(guest).map((s) => s.id)).not.toEqual(expect.arrayContaining(["devices"]));
    expect(visibleSections(guest).map((s) => s.id)).not.toContain("notifications");
  });

  it("droits inconnus (serveur pas encore répondu) : rien de ce qui en dépend", () => {
    const pending: ProfileContext = { ...full, abilities: new Set() };
    expect(visibleSections(pending).map((s) => s.id)).toEqual(["account", "playback", "offline", "help"]);
  });
});

describe("hors ligne", () => {
  it("le suivi en direct n'existe que là où l'appareil sait le montrer", () => {
    expect(ids(section("offline"), { ...full, liveTransfers: false })).not.toContain("liveTransfers");
    expect(ids(section("offline"), full).indexOf("liveTransfers")).toBe(ids(section("offline"), full).indexOf("notifyReady") + 1);
  });
});

describe("le web étroit rend le même catalogue", () => {
  it("sans ce que seul le mobile sait faire", () => {
    const shown = ids(section("playback"), web);
    for (const id of ["liquidGlass", "subtitleSize", "subtitlePosition", "engine", "engineOptions"]) expect(shown).not.toContain(id);
    expect(visibleSections(web).map((s) => s.id)).toEqual(["account", "playback", "devices", "help"]);
    expect(ids(section("account"), web)).not.toContain("changeServer");
  });

  it("les capacités du serveur décident, jamais une version", () => {
    expect(ids(section("playback"), { ...web, capabilities: new Set() })).not.toContain("stillWatching");
    expect(ids(section("playback"), web)).toEqual(expect.arrayContaining(["stillWatching", "trendingNow"]));
  });
});

describe("portée de chaque réglage (la pastille dit la vérité)", () => {
  const controls = allEntries.filter((e): e is ProfileEntry & { kind: "control"; id: ProfileControlId } => e.kind === "control");

  it("chaque réglage sur place a sa portée inventoriée", () => {
    for (const entry of controls) expect(SETTINGS_CONTROLS).toHaveProperty(entry.id);
  });

  it("un groupe à portée ne contient que des réglages de cette portée", () => {
    for (const s of SETTINGS_SECTIONS) {
      for (const group of s.groups) {
        if (!group.scope) continue;
        for (const entry of group.entries) {
          const scope = entry.kind === "control" ? settingScopeOf(entry.id) : entry.kind === "pane" ? PANE_SCOPES[entry.id] : null;
          expect(scope, `${s.id}:${entry.id}`).toBe(group.scope);
        }
      }
    }
  });

  it("ce qui passe par le serveur est « Compte », ce qui reste dans l'appareil est « Cet appareil »", () => {
    for (const id of ["intros", "nextAutoPlay", "stillWatching", "language", "trendingNow", "photo"] as const) {
      expect(settingScopeOf(id)).toBe("account");
    }
    for (const id of ["theme", "liquidGlass", "subtitleSize", "subtitlePosition", "dataSaver", "engine", "engineOptions"] as const) {
      expect(settingScopeOf(id)).toBe("device");
    }
    expect(PANE_SCOPES.mediaLanguages).toBe("account");
    expect(PANE_SCOPES.personalization).toBe("account");
  });
});

describe("réservé au bureau", () => {
  it("chaque réglage énuméré a son libellé dans les deux langues", () => {
    expect(DESKTOP_ONLY_SETTINGS.length).toBeGreaterThan(0);
    for (const ref of DESKTOP_ONLY_SETTINGS) {
      expect(lookup(frSettings, ref.key), ref.key).toBeTypeOf("string");
      expect(lookup(enSettings, ref.key), ref.key).toBeTypeOf("string");
    }
  });
});

const TABLES: Record<string, [Record<string, unknown>, Record<string, unknown>]> = {
  profile: [frProfile, enProfile],
  offline: [frOffline, enOffline],
  nav: [frNav, enNav],
  sessions: [frSessions, enSessions],
  settingsMobile: [frSettings, enSettings],
};
/** Le mot que le mobile n'écrit jamais (CLAUDE.md, espace `offline`). */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

const lookup = (table: Record<string, unknown> | undefined, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], table);

describe("libellés de la structure", () => {
  const refs: I18nRef[] = SETTINGS_SECTIONS.flatMap((s) => [
    s.label,
    ...s.summaries.map((m) => m.label),
    ...s.groups.flatMap((g) => [
      ...(g.title ? [g.title] : []),
      ...(g.caption ? [g.caption] : []),
      ...g.entries.flatMap((e) => (e.kind === "control" || e.kind === "block" ? [] : [e.label])),
    ]),
  ]);

  it("chaque libellé existe en français et en anglais, sans le mot interdit", () => {
    for (const ref of refs) {
      const [fr, en] = TABLES[ref.ns] ?? [];
      const frText = lookup(fr, ref.key);
      const enText = lookup(en, ref.key);
      expect(frText, `${ref.ns}:${ref.key} (fr)`).toBeTypeOf("string");
      expect(enText, `${ref.ns}:${ref.key} (en)`).toBeTypeOf("string");
      expect(FORBIDDEN.test(`${String(frText)} ${String(enText)}`), `${ref.ns}:${ref.key}`).toBe(false);
    }
  });
});
