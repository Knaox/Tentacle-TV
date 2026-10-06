import { PROFILE_SECTIONS } from "./profileSections";
import type { ProfilePaneId } from "./profilePanes";

/**
 * La STRUCTURE du profil (mobile et tablette) : sept rubriques, chacune une
 * page de groupes, chaque entrée un réglage sur place, une page (volet ou
 * écran) ou une action. DEUX niveaux, jamais trois : une rubrique ouvre sa
 * page, une entrée de la page ouvre la sienne, et une page de deuxième niveau
 * ne contient plus d'entrée de cette structure. Les données vivent dans
 * `profileSections.ts` ; ici, les types et les règles — un module pur, testé.
 *
 * Hors ligne, il ne reste que ce qui vit sur l'appareil : ce qui parle au
 * serveur disparaît au lieu d'échouer, et une rubrique vide disparaît avec.
 */

export type ProfileSectionId = "account" | "devices" | "playback" | "appearance" | "notifications" | "server" | "help";

/** Un libellé : sa clé et son espace i18n. */
export interface I18nRef {
  ns: string;
  key: string;
}

/**
 * Ce qu'une entrée exige pour paraître (toutes les conditions à la fois) :
 * - `online` : le serveur répond (pas hors ligne) ;
 * - `admin` : un administrateur ;
 * - `offlineVisible` : le droit de garder des titres, ou des titres déjà là ;
 * - `canGoOffline` : en ligne ET hors ligne permis (« Passer hors ligne ») ;
 * - `family` : le serveur annonce la Famille, activée, et l'écran est branché ;
 * - `liquidGlass` : le rendu Liquid Glass existe sur cet appareil (iOS 26).
 */
export type ProfileRequirement = "online" | "admin" | "offlineVisible" | "canGoOffline" | "family" | "liquidGlass";

export type ProfileControlId = "theme" | "language" | "liquidGlass";
export type ProfileActionId = "changeServer" | "goOffline" | "clearCache" | "deleteAccount" | "privacyPolicy";

interface EntryBase {
  requires?: readonly ProfileRequirement[];
}

/** Un réglage qui se fait SUR PLACE, dans la page de sa rubrique. */
export interface ControlEntry extends EntryBase {
  kind: "control";
  id: ProfileControlId;
}

/** Une page de réglages (volet) : plein écran sur téléphone, colonne de détail sur tablette. */
export interface PaneEntry extends EntryBase {
  kind: "pane";
  id: ProfilePaneId;
  icon: string;
  label: I18nRef;
}

/** Un écran à part entière (statistiques, support…), identique sur les deux formats. */
export interface ScreenEntry extends EntryBase {
  kind: "screen";
  id: string;
  href: string;
  icon: string;
  label: I18nRef;
}

/** Un geste : une confirmation, une page externe, un changement d'état. */
export interface ActionEntry extends EntryBase {
  kind: "action";
  id: ProfileActionId;
  icon: string;
  label: I18nRef;
  destructive?: boolean;
}

export type ProfileEntry = ControlEntry | PaneEntry | ScreenEntry | ActionEntry;

export interface ProfileGroup {
  title?: I18nRef;
  entries: readonly ProfileEntry[];
}

/** Le résumé d'une rubrique sous son nom : le premier dont les conditions tiennent. */
export interface SectionSummary {
  requires?: readonly ProfileRequirement[];
  label: I18nRef;
}

export interface ProfileSection {
  id: ProfileSectionId;
  icon: string;
  label: I18nRef;
  summaries: readonly SectionSummary[];
  groups: readonly ProfileGroup[];
}

export interface ProfileContext {
  offline: boolean;
  isAdmin: boolean;
  offlineVisible: boolean;
  /** Hors ligne permis par le serveur et l'appareil (`useOfflineVisibility`). */
  canGoOffline: boolean;
  family: boolean;
  liquidGlass: boolean;
}

/** Une condition tient-elle dans ce contexte ? */
export function meets(requirement: ProfileRequirement, ctx: ProfileContext): boolean {
  switch (requirement) {
    case "online": return !ctx.offline;
    case "admin": return ctx.isAdmin;
    case "offlineVisible": return ctx.offlineVisible;
    case "canGoOffline": return !ctx.offline && ctx.canGoOffline;
    case "family": return !ctx.offline && ctx.family;
    case "liquidGlass": return ctx.liquidGlass;
  }
}

function meetsAll(requires: readonly ProfileRequirement[] | undefined, ctx: ProfileContext): boolean {
  return (requires ?? []).every((r) => meets(r, ctx));
}

export function isEntryVisible(entry: ProfileEntry, ctx: ProfileContext): boolean {
  return meetsAll(entry.requires, ctx);
}

/** Les groupes d'une rubrique, réduits à leurs entrées visibles ; un groupe vide disparaît. */
export function visibleGroups(section: ProfileSection, ctx: ProfileContext): ProfileGroup[] {
  return section.groups
    .map((group) => ({ ...group, entries: group.entries.filter((e) => isEntryVisible(e, ctx)) }))
    .filter((group) => group.entries.length > 0);
}

/** Les rubriques à montrer, dans l'ordre : une rubrique sans entrée visible disparaît. */
export function visibleSections(ctx: ProfileContext): ProfileSection[] {
  return PROFILE_SECTIONS.filter((section) => visibleGroups(section, ctx).length > 0);
}

export function findSection(id: string): ProfileSection | undefined {
  return PROFILE_SECTIONS.find((section) => section.id === id);
}

/**
 * Ce qu'ouvre une rubrique : sa page, ou — quand elle ne contient qu'UN volet
 * (Appareils et TV, Notifications) — ce volet directement, sans page intermédiaire d'une seule
 * ligne.
 */
export type SectionTarget = { kind: "page" } | { kind: "pane"; id: ProfilePaneId };

export function sectionTarget(section: ProfileSection, ctx: ProfileContext): SectionTarget {
  const entries = visibleGroups(section, ctx).flatMap((group) => group.entries);
  const only = entries.length === 1 ? entries[0] : undefined;
  return only?.kind === "pane" ? { kind: "pane", id: only.id } : { kind: "page" };
}

export function sectionSummary(section: ProfileSection, ctx: ProfileContext): I18nRef | undefined {
  return section.summaries.find((summary) => meetsAll(summary.requires, ctx))?.label;
}

/**
 * La rubrique à montrer sur tablette : celle qu'on a choisie si elle existe
 * encore (passer hors ligne en retire), sinon la première.
 */
export function resolveSection(selected: ProfileSectionId | null, ctx: ProfileContext): ProfileSectionId | null {
  const sections = visibleSections(ctx);
  if (selected && sections.some((s) => s.id === selected)) return selected;
  return sections[0]?.id ?? null;
}
