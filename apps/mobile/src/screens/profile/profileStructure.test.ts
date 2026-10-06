import { describe, expect, it } from "vitest";
import frNav from "../../../../../packages/shared/src/i18n/locales/fr/nav";
import enNav from "../../../../../packages/shared/src/i18n/locales/en/nav";
import frOffline from "../../../../../packages/shared/src/i18n/locales/fr/offline";
import enOffline from "../../../../../packages/shared/src/i18n/locales/en/offline";
import frProfile from "../../../../../packages/shared/src/i18n/locales/fr/profile";
import enProfile from "../../../../../packages/shared/src/i18n/locales/en/profile";
import frSessions from "../../../../../packages/shared/src/i18n/locales/fr/sessions";
import enSessions from "../../../../../packages/shared/src/i18n/locales/en/sessions";
import frTrailerHelp from "../../../../../packages/shared/src/i18n/locales/fr/trailerHelp";
import enTrailerHelp from "../../../../../packages/shared/src/i18n/locales/en/trailerHelp";
import { FAMILY_ROUTE } from "../../../../../packages/api-client/src/utils/notificationRoute";
import { PROFILE_PANES, PROFILE_PANE_ROUTES } from "./profilePanes";
import { FAMILY_HREF, PROFILE_SECTIONS } from "./profileSections";
import {
  resolveSection, sectionSummary, sectionTarget, visibleGroups, visibleSections,
  type I18nRef, type ProfileContext, type ProfileEntry, type ProfileSection,
} from "./profileStructure";

const user: ProfileContext = { offline: false, isAdmin: false, offlineVisible: false, canGoOffline: false, family: false, liquidGlass: false };
const admin: ProfileContext = { ...user, isAdmin: true, offlineVisible: true, canGoOffline: true, liquidGlass: true };
const offline: ProfileContext = { ...admin, offline: true };

const entries = (section: ProfileSection, ctx: ProfileContext): ProfileEntry[] =>
  visibleGroups(section, ctx).flatMap((g) => g.entries);
const ids = (section: ProfileSection, ctx: ProfileContext) => entries(section, ctx).map((e) => e.id);
const section = (id: string) => PROFILE_SECTIONS.find((s) => s.id === id)!;
const allEntries = PROFILE_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

describe("structure du profil", () => {
  it("sept rubriques au plus, et aucune page de rubrique au-delà de six entrées", () => {
    expect(PROFILE_SECTIONS.length).toBeLessThanOrEqual(7);
    for (const s of PROFILE_SECTIONS) expect(entries(s, { ...admin, family: true }).length).toBeLessThanOrEqual(6);
  });

  it("chaque volet est rangé une fois, et une seule", () => {
    const panes = allEntries.filter((e) => e.kind === "pane").map((e) => e.id);
    expect([...panes].sort()).toEqual([...PROFILE_PANES].sort());
  });

  it("chaque entrée a un identifiant unique", () => {
    const all = allEntries.map((e) => `${e.kind}:${e.id}`);
    expect(new Set(all).size).toBe(all.length);
  });

  it("les anciennes destinations restent atteignables depuis la structure", () => {
    const reachable = new Set<string>([
      ...allEntries.flatMap((e) => (e.kind === "screen" ? [e.href] : e.kind === "pane" ? [PROFILE_PANE_ROUTES[e.id]] : [])),
    ]);
    for (const route of Object.values(PROFILE_PANE_ROUTES)) expect(reachable).toContain(route);
    for (const route of ["/support", "/about", "/help/trailers", "/on-device", "/admin/sessions"]) expect(reachable).toContain(route);
  });

  it("la Famille ouvre l'écran des notifications Famille", () => {
    expect(FAMILY_HREF).toBe(FAMILY_ROUTE);
  });

  it("hors ligne, il ne reste que ce qui vit sur l'appareil", () => {
    expect(visibleSections(offline).map((s) => s.id)).toEqual(["playback", "appearance", "help"]);
    expect(ids(section("playback"), offline)).toEqual(["playback", "data", "offlineTitles", "onDevice"]);
    expect(ids(section("appearance"), offline)).toEqual(["theme", "language", "liquidGlass"]);
    expect(ids(section("help"), offline)).toEqual(["about", "privacyPolicy"]);
  });

  it("en ligne, toutes les rubriques paraissent", () => {
    expect(visibleSections(user).map((s) => s.id)).toEqual(["account", "devices", "playback", "appearance", "notifications", "server", "help"]);
  });

  it("les invitations et les sessions sont réservées à un administrateur", () => {
    expect(ids(section("server"), user)).toEqual(["changeServer", "clearCache"]);
    expect(ids(section("server"), admin)).toEqual(["changeServer", "invites", "sessions", "clearCache"]);
    expect(sectionSummary(section("server"), admin)?.key).toBe("serverSummaryAdmin");
  });

  it("« Passer hors ligne » et les titres gardés suivent leurs droits", () => {
    expect(ids(section("playback"), user)).toEqual(["playback", "data"]);
    expect(ids(section("playback"), admin)).toEqual(["playback", "data", "offlineTitles", "onDevice", "goOffline"]);
  });

  it("la Famille reste cachée tant que le serveur ne l'annonce pas", () => {
    expect(ids(section("account"), user)).toEqual(["password", "deleteAccount"]);
    expect(ids(section("account"), { ...user, family: true })).toEqual(["password", "family", "deleteAccount"]);
    expect(sectionSummary(section("account"), { ...user, family: true })?.key).toBe("accountSummaryFamily");
    expect(ids(section("account"), { ...offline, family: true })).toEqual([]);
  });

  it("Liquid Glass ne paraît que là où il existe", () => {
    expect(ids(section("appearance"), user)).toEqual(["theme", "language", "personalization"]);
  });

  it("une rubrique d'un seul volet ouvre ce volet, les autres leur page", () => {
    expect(sectionTarget(section("notifications"), user)).toEqual({ kind: "pane", id: "notifications" });
    expect(sectionTarget(section("account"), user)).toEqual({ kind: "page" });
  });

  it("« Appareils et TV » est la deuxième rubrique, et ouvre DIRECTEMENT le jumelage", () => {
    expect(visibleSections(user)[1]?.id).toBe("devices");
    expect(sectionTarget(section("devices"), user)).toEqual({ kind: "pane", id: "devices" });
    expect(PROFILE_PANE_ROUTES.devices).toBe("/settings/devices");
    // Une seule entrée : rien ne la double dans Compte.
    expect(allEntries.filter((e) => e.id === "devices")).toHaveLength(1);
  });

  it("hors ligne, « Appareils et TV » disparaît (le jumelage parle au serveur)", () => {
    expect(visibleSections(offline).some((s) => s.id === "devices")).toBe(false);
  });

  it("la tablette garde la rubrique choisie tant qu'elle existe", () => {
    expect(resolveSection(null, user)).toBe("account");
    expect(resolveSection("server", user)).toBe("server");
    expect(resolveSection("server", offline)).toBe("playback");
  });
});

const TABLES: Record<string, [Record<string, unknown>, Record<string, unknown>]> = {
  profile: [frProfile, enProfile],
  offline: [frOffline, enOffline],
  nav: [frNav, enNav],
  sessions: [frSessions, enSessions],
  trailerHelp: [frTrailerHelp, enTrailerHelp],
};
/** Le mot que le mobile n'écrit jamais (CLAUDE.md, espace `offline`). */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

describe("libellés de la structure", () => {
  const refs: I18nRef[] = PROFILE_SECTIONS.flatMap((s) => [
    s.label,
    ...s.summaries.map((m) => m.label),
    ...s.groups.flatMap((g) => [...(g.title ? [g.title] : []), ...g.entries.flatMap((e) => (e.kind === "control" ? [] : [e.label]))]),
  ]);

  it("chaque libellé existe en français et en anglais, sans le mot interdit", () => {
    for (const ref of refs) {
      const [fr, en] = TABLES[ref.ns] ?? [];
      expect(fr?.[ref.key], `${ref.ns}:${ref.key} (fr)`).toBeTypeOf("string");
      expect(en?.[ref.key], `${ref.ns}:${ref.key} (en)`).toBeTypeOf("string");
      expect(FORBIDDEN.test(`${fr?.[ref.key]} ${en?.[ref.key]}`), `${ref.ns}:${ref.key}`).toBe(false);
    }
  });
});
