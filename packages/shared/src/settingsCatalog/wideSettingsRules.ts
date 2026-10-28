import { meetsSettingsRequirement } from "./settingsCatalogRules";
import type { SettingsI18nRef } from "./settingsCatalogTypes";
import { WIDE_SETTINGS_SECTIONS, WIDE_SETTING_SECTION } from "./wideSettingsSections";
import type {
  WideSettingEntry, WideSettingId, WideSettingsContext, WideSettingsGroup, WideSettingsRequirement, WideSettingsSection,
  WideSettingsSectionId,
} from "./wideSettingsTypes";

/**
 * Les RÈGLES du catalogue du web large — pures, testées. Une ligne dont les
 * conditions ne tiennent pas n'existe pas (ni dans sa page, ni dans la
 * recherche) ; un groupe vide, une rubrique vide disparaissent avec elle.
 */

export function meetsWideRequirement(requirement: WideSettingsRequirement, ctx: WideSettingsContext): boolean {
  switch (requirement) {
    case "desktopApp": return ctx.desktopApp;
    case "glassToggle": return ctx.glassToggle;
    case "octave": return ctx.octave;
    case "downloads": return ctx.downloads;
    case "backgroundTransfers": return ctx.backgroundTransfers === true;
    case "hardwareDecoding": return ctx.hardwareDecoding;
    case "hdrAuto": return ctx.hdrAuto;
    case "linuxSession": return ctx.linuxSession;
    // Pas encore su : la ligne reste (son composant se tait si le serveur ne sait pas).
    case "vigieReco": return ctx.vigieReco !== false;
    default: return meetsSettingsRequirement(requirement, ctx);
  }
}

export function isWideSettingVisible(entry: WideSettingEntry, ctx: WideSettingsContext): boolean {
  if (entry.capability && !ctx.capabilities.has(entry.capability)) return false;
  return (entry.requires ?? []).every((r) => meetsWideRequirement(r, ctx));
}

export function visibleWideGroups(section: WideSettingsSection, ctx: WideSettingsContext): WideSettingsGroup[] {
  return section.groups
    .map((g) => ({ ...g, entries: g.entries.filter((e) => isWideSettingVisible(e, ctx)) }))
    .filter((g) => g.entries.length > 0);
}

export function visibleWideSections(ctx: WideSettingsContext): WideSettingsSection[] {
  return WIDE_SETTINGS_SECTIONS.filter((s) => visibleWideGroups(s, ctx).length > 0);
}

/** La première rubrique visible : l'atterrissage de `/settings` sur grand écran. */
export function firstWideSection(ctx: WideSettingsContext): WideSettingsSectionId {
  return visibleWideSections(ctx)[0]?.id ?? "appearance";
}

/** Un lien vers un réglage : sa rubrique et son ancre. */
export function wideSettingPath(id: WideSettingId): string {
  return `/settings/${WIDE_SETTING_SECTION[id]}#${id}`;
}

/**
 * Les ANCIENNES adresses des réglages du web large (signets, nouveautés, liens
 * du mobile et du web étroit), vers la rubrique qui a recueilli leurs
 * réglages. `/settings/<clé>` → le chemin donné.
 */
export const WIDE_LEGACY_PATHS: Readonly<Record<string, string>> = {
  data: wideSettingPath("dataSaver"),
  "media-languages": wideSettingPath("libraryTracks"),
  password: wideSettingPath("password"),
  devices: wideSettingPath("pairedDevices"),
};

/** Minuscules, sans accents ni ponctuation : « Sous-titres » se trouve en tapant « sous titre ». */
export function normalizeSettingsQuery(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface WideSettingsSearchHit {
  entry: WideSettingEntry;
  section: WideSettingsSection;
  group: WideSettingsGroup;
  score: number;
}

/**
 * La recherche des réglages (macOS, Spotify, Windows : un champ en tête des
 * réglages). Chaque mot tapé doit se trouver dans le libellé, les mots-clés,
 * l'explication, le groupe ou la rubrique du réglage ; le libellé pèse le plus.
 * Un mot tapé « sous titre » trouve « Sous-titres » (préfixe, sans accents).
 * `translate` rend un texte du catalogue dans la langue de l'interface.
 */
export function searchWideSettings(
  query: string,
  ctx: WideSettingsContext,
  translate: (ref: SettingsI18nRef) => string,
): WideSettingsSearchHit[] {
  const words = normalizeSettingsQuery(query).split(" ").filter((word) => word.length > 0);
  if (words.length === 0) return [];
  const hits: WideSettingsSearchHit[] = [];
  for (const section of visibleWideSections(ctx)) {
    for (const group of visibleWideGroups(section, ctx)) {
      for (const entry of group.entries) {
        const fields = [
          { text: translate(entry.label), weight: 8 },
          { text: entry.keywords ? translate(entry.keywords) : "", weight: 4 },
          { text: translate(group.title), weight: 2 },
          { text: translate(section.label), weight: 2 },
          { text: translate(entry.description), weight: 1 },
        ].map((field) => ({ words: normalizeSettingsQuery(field.text).split(" "), weight: field.weight }));
        let score = 0;
        const allFound = words.every((word) => {
          const best = Math.max(0, ...fields.map((f) => (f.words.some((w) => w.startsWith(word)) ? f.weight : 0)));
          score += best;
          return best > 0;
        });
        if (allFound) hits.push({ entry, section, group, score });
      }
    }
  }
  // À score égal, l'ordre du rail (le tri est stable).
  return hits.sort((a, b) => b.score - a.score);
}
