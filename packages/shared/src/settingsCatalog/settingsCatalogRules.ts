import { SETTINGS_SECTIONS } from "./settingsSections";
import type {
  SettingsCatalogContext, SettingsCatalogEntry, SettingsCatalogGroup, SettingsI18nRef, SettingsPaneId,
  SettingsRequirement, SettingsCatalogSection, SettingsSectionId, SettingsSectionSummary,
} from "./settingsCatalogTypes";

/**
 * Les RÈGLES du catalogue des réglages — pures, testées. Hors ligne, il ne
 * reste que ce qui vit sur l'appareil : ce qui parle au serveur disparaît au
 * lieu d'échouer, et une rubrique vide disparaît avec.
 */

/**
 * Les rubriques d'avant la refonte : un lien `/profile/appearance` ou
 * `/profile/server` (signet, notification, écran qui y renvoie) arrive dans
 * celle qui a recueilli leurs réglages.
 */
export const LEGACY_SETTINGS_SECTION_ALIASES: Readonly<Record<string, SettingsSectionId>> = {
  appearance: "playback",
  server: "account",
};

/** Une condition tient-elle dans ce contexte ? */
export function meetsSettingsRequirement(requirement: SettingsRequirement, ctx: SettingsCatalogContext): boolean {
  switch (requirement) {
    case "online": return !ctx.offline;
    case "admin": return ctx.isAdmin;
    case "offlineVisible": return ctx.offlineVisible;
    case "canGoOffline": return !ctx.offline && ctx.canGoOffline;
    case "family": return !ctx.offline && ctx.family;
    case "canSwitchProfile": return !ctx.offline && ctx.canSwitchProfile;
    case "liquidGlass": return ctx.liquidGlass;
    case "advancedEngine": return ctx.advancedEngine;
    case "engineOptions": return ctx.engineOptions;
    case "bootIntro": return ctx.bootIntro;
    case "liveTransfers": return ctx.liveTransfers;
    case "personal": return !ctx.profileSession;
  }
}

function meetsAll(requires: readonly SettingsRequirement[] | undefined, ctx: SettingsCatalogContext): boolean {
  return (requires ?? []).every((r) => meetsSettingsRequirement(r, ctx));
}

export function isSettingsEntryVisible(entry: SettingsCatalogEntry, ctx: SettingsCatalogContext): boolean {
  if (entry.platforms && !entry.platforms.includes(ctx.platform)) return false;
  if (entry.capability && !ctx.capabilities.has(entry.capability)) return false;
  return meetsAll(entry.requires, ctx);
}

/** Les groupes d'une rubrique, réduits à leurs entrées visibles ; un groupe vide disparaît. */
export function visibleSettingsGroups(section: SettingsCatalogSection, ctx: SettingsCatalogContext): SettingsCatalogGroup[] {
  return section.groups
    .map((group) => ({ ...group, entries: group.entries.filter((e) => isSettingsEntryVisible(e, ctx)) }))
    .filter((group) => group.entries.length > 0);
}

/** Les rubriques à montrer, dans l'ordre : une rubrique sans entrée visible disparaît. */
export function visibleSettingsSections(ctx: SettingsCatalogContext): SettingsCatalogSection[] {
  return SETTINGS_SECTIONS.filter((section) => visibleSettingsGroups(section, ctx).length > 0);
}

export function findSettingsSection(id: string): SettingsCatalogSection | undefined {
  const resolved = LEGACY_SETTINGS_SECTION_ALIASES[id] ?? id;
  return SETTINGS_SECTIONS.find((section) => section.id === resolved);
}

/**
 * Ce qu'ouvre une rubrique : sa page, ou — quand elle ne contient qu'UN volet
 * (TV et appareils, Notifications) — ce volet directement, sans page
 * intermédiaire d'une seule ligne.
 */
export type SettingsSectionTarget = { kind: "page" } | { kind: "pane"; id: SettingsPaneId };

export function settingsSectionTarget(section: SettingsCatalogSection, ctx: SettingsCatalogContext): SettingsSectionTarget {
  const entries = visibleSettingsGroups(section, ctx).flatMap((group) => group.entries);
  const only = entries.length === 1 ? entries[0] : undefined;
  return only?.kind === "pane" ? { kind: "pane", id: only.id } : { kind: "page" };
}

export function settingsSectionSummary(section: SettingsCatalogSection, ctx: SettingsCatalogContext): SettingsI18nRef | undefined {
  return section.summaries.find((summary: SettingsSectionSummary) => meetsAll(summary.requires, ctx))?.label;
}

/**
 * La rubrique à montrer sur tablette (ou grand écran) : celle qu'on a choisie
 * si elle existe encore (passer hors ligne en retire), sinon la première.
 */
export function resolveSettingsSection(selected: SettingsSectionId | null, ctx: SettingsCatalogContext): SettingsSectionId | null {
  const sections = visibleSettingsSections(ctx);
  if (selected && sections.some((s) => s.id === selected)) return selected;
  return sections[0]?.id ?? null;
}
