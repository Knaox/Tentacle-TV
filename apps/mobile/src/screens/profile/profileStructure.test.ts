import { describe, expect, it } from "vitest";
import frNav from "../../../../../packages/shared/src/i18n/locales/fr/nav";
import enNav from "../../../../../packages/shared/src/i18n/locales/en/nav";
import frOffline from "../../../../../packages/shared/src/i18n/locales/fr/offline";
import enOffline from "../../../../../packages/shared/src/i18n/locales/en/offline";
import frProfile from "../../../../../packages/shared/src/i18n/locales/fr/profile";
import enProfile from "../../../../../packages/shared/src/i18n/locales/en/profile";
import frSessions from "../../../../../packages/shared/src/i18n/locales/fr/sessions";
import enSessions from "../../../../../packages/shared/src/i18n/locales/en/sessions";
import frSettings from "../../../../../packages/shared/src/i18n/locales/fr/settingsMobile";
import enSettings from "../../../../../packages/shared/src/i18n/locales/en/settingsMobile";
import { FAMILY_ROUTE } from "../../../../../packages/api-client/src/utils/notificationRoute";
import { LEGACY_PANE_REDIRECTS, PROFILE_PANES, PROFILE_PANE_ROUTES } from "./profilePanes";
import { FAMILY_HREF, PROFILE_SECTIONS } from "./profileSections";
import {
  findSection, resolveSection, sectionSummary, sectionTarget, visibleGroups, visibleSections,
  type I18nRef, type ProfileContext, type ProfileControlId, type ProfileEntry, type ProfileSection,
} from "./profileStructure";
import { CONTROL_SCOPES, PANE_SCOPES } from "./settingsScopes";

const user: ProfileContext = {
  offline: false, isAdmin: false, offlineVisible: false, canGoOffline: false, family: false, canSwitchProfile: false,
  liquidGlass: false, stillWatching: false, trendingNow: false, advancedEngine: false, engineOptions: false, profileSession: false,
};
const full: ProfileContext = {
  ...user, isAdmin: true, offlineVisible: true, canGoOffline: true, family: true, canSwitchProfile: true,
  liquidGlass: true, stillWatching: true, trendingNow: true, advancedEngine: true, engineOptions: true,
};
const offline: ProfileContext = { ...full, offline: true };
const profileSession: ProfileContext = { ...full, isAdmin: false, profileSession: true };

const entries = (section: ProfileSection, ctx: ProfileContext): ProfileEntry[] =>
  visibleGroups(section, ctx).flatMap((g) => g.entries);
const ids = (section: ProfileSection, ctx: ProfileContext) => entries(section, ctx).map((e) => e.id);
const section = (id: string) => PROFILE_SECTIONS.find((s) => s.id === id)!;
const allEntries = PROFILE_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

describe("structure des réglages", () => {
  it("six rubriques, dans l'ordre du plan", () => {
    expect(PROFILE_SECTIONS.map((s) => s.id)).toEqual(["account", "playback", "devices", "offline", "notifications", "help"]);
  });

  it("chaque volet est rangé une fois, et une seule", () => {
    const panes = allEntries.filter((e) => e.kind === "pane").map((e) => e.id);
    expect([...panes].sort()).toEqual([...PROFILE_PANES].sort());
  });

  it("chaque entrée est unique, sauf le renvoi vers le bureau (Lecture ET Aide)", () => {
    const all = allEntries.map((e) => `${e.kind}:${e.id}`).filter((key) => key !== "control:advancedOnDesktop");
    expect(new Set(all).size).toBe(all.length);
    expect(allEntries.filter((e) => e.id === "advancedOnDesktop")).toHaveLength(2);
  });

  it("l'Aide du mobile n'offre plus le guide des bandes-annonces (rien à y régler)", () => {
    expect(allEntries.some((e) => e.kind === "screen" && e.href.startsWith("/help/trailers"))).toBe(false);
  });

  it("les anciennes destinations restent atteignables", () => {
    const reachable = new Set<string>(
      allEntries.flatMap((e) => (e.kind === "screen" ? [e.href] : e.kind === "pane" ? [PROFILE_PANE_ROUTES[e.id]] : [])),
    );
    for (const route of Object.values(PROFILE_PANE_ROUTES)) expect(reachable).toContain(route);
    for (const route of ["/support", "/about", "/on-device", "/admin/sessions"]) expect(reachable).toContain(route);
    // Les volets fondus dans une page redirigent vers une rubrique qui existe.
    for (const target of Object.values(LEGACY_PANE_REDIRECTS)) {
      expect(findSection(target.replace("/profile/", ""))).toBeDefined();
    }
  });

  it("les rubriques d'avant (Apparence, Serveur) mènent à celle qui les a recueillies", () => {
    expect(findSection("appearance")?.id).toBe("playback");
    expect(findSection("server")?.id).toBe("account");
    expect(findSection("inconnue")).toBeUndefined();
  });

  it("la Famille ouvre l'écran des notifications Famille", () => {
    expect(FAMILY_HREF).toBe(FAMILY_ROUTE);
  });

  it("hors ligne, il ne reste que ce qui vit sur l'appareil", () => {
    expect(visibleSections(offline).map((s) => s.id)).toEqual(["playback", "offline", "help"]);
    expect(ids(section("offline"), offline)).toEqual(["offlineTitles", "offlineSettings"]);
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
      "photo", "userName", "password", "family", "switchProfile", "changeServer", "invites", "sessions", "clearCache", "deleteAccount",
    ]);
    expect(sectionSummary(section("account"), full)?.key).toBe("sections.accountSummaryFamily");
  });

  it("« Changer de profil » exige une famille d'au moins deux profils", () => {
    expect(ids(section("account"), { ...full, canSwitchProfile: false })).not.toContain("switchProfile");
  });

  it("en session de profil, rien de ce que le serveur refuse", () => {
    expect(ids(section("account"), profileSession)).toEqual(["userName", "switchProfile", "clearCache"]);
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

describe("portée de chaque réglage (la pastille dit la vérité)", () => {
  const controls = allEntries.filter((e): e is ProfileEntry & { kind: "control"; id: ProfileControlId } => e.kind === "control");

  it("chaque réglage sur place a sa portée inventoriée", () => {
    for (const entry of controls) expect(CONTROL_SCOPES).toHaveProperty(entry.id);
  });

  it("un groupe à portée ne contient que des réglages de cette portée", () => {
    for (const s of PROFILE_SECTIONS) {
      for (const group of s.groups) {
        if (!group.scope) continue;
        for (const entry of group.entries) {
          const scope = entry.kind === "control" ? CONTROL_SCOPES[entry.id] : entry.kind === "pane" ? PANE_SCOPES[entry.id] : null;
          expect(scope, `${s.id}:${entry.id}`).toBe(group.scope);
        }
      }
    }
  });

  it("ce qui passe par le serveur est « Compte », ce qui reste dans l'appareil est « Cet appareil »", () => {
    for (const id of ["intros", "nextAutoPlay", "stillWatching", "language", "trendingNow", "photo"] as const) {
      expect(CONTROL_SCOPES[id]).toBe("account");
    }
    for (const id of ["theme", "liquidGlass", "subtitleSize", "subtitlePosition", "dataSaver", "engine", "engineOptions"] as const) {
      expect(CONTROL_SCOPES[id]).toBe("device");
    }
    expect(PANE_SCOPES.mediaLanguages).toBe("account");
    expect(PANE_SCOPES.personalization).toBe("account");
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
  const refs: I18nRef[] = PROFILE_SECTIONS.flatMap((s) => [
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
