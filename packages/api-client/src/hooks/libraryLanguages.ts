/**
 * Les langues audio et de sous-titres d'une bibliothèque, telles que Jellyfin
 * 12 les rend dans `/Items/Filters2` — pur, pour que la suite de
 * compatibilité et les tests l'éprouvent sans React.
 *
 * DÉTECTION PAR CAPACITÉ, pas par numéro de version : un Jellyfin qui ne rend
 * pas ces listes ne sait pas filtrer par langue (10.10, 10.11). Il IGNORERAIT
 * le paramètre `AudioLanguages` et rendrait tout — mesuré. `null` dit donc
 * « n'affichez pas le filtre ».
 */

import { normalizeLanguageCode } from "@tentacle-tv/shared";

export interface LanguageOption {
  /** Le code normalisé (ISO 639-1, « fr »), clé stable du filtre. */
  code: string;
  /** Les codes tels que Jellyfin les connaît (« fre », « fra ») — ce qu'on lui renvoie. */
  values: string[];
}

export interface LibraryLanguages {
  audio: LanguageOption[];
  subtitle: LanguageOption[];
}

interface NameValue { Name?: string; Value?: string }

function group(entries: readonly NameValue[]): LanguageOption[] {
  const byCode = new Map<string, Set<string>>();
  for (const entry of entries) {
    const raw = entry.Value?.trim();
    if (!raw) continue;
    const code = normalizeLanguageCode(raw) ?? raw.toLowerCase();
    if (!byCode.has(code)) byCode.set(code, new Set());
    byCode.get(code)!.add(raw);
  }
  return [...byCode].map(([code, values]) => ({ code, values: [...values] }));
}

export function parseLibraryLanguages(raw: unknown): LibraryLanguages | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { AudioLanguages?: unknown; SubtitleLanguages?: unknown };
  if (!Array.isArray(body.AudioLanguages) && !Array.isArray(body.SubtitleLanguages)) return null;
  return {
    audio: group(Array.isArray(body.AudioLanguages) ? (body.AudioLanguages as NameValue[]) : []),
    subtitle: group(Array.isArray(body.SubtitleLanguages) ? (body.SubtitleLanguages as NameValue[]) : []),
  };
}

/**
 * Ce que le catalogue envoie à Jellyfin pour la langue choisie (son code
 * stable, « fr ») : TOUS ses codes Jellyfin — « fre » ET « fra », que Jellyfin
 * 12 mélange dans une même bibliothèque. Rien sans choix.
 */
export function languageValues(options: readonly LanguageOption[] | null | undefined, code: string | null | undefined): string[] | undefined {
  return code ? options?.find((o) => o.code === code)?.values : undefined;
}

/** La route qui les donne — celle que le hook et la suite appellent. */
export function libraryLanguagesPath(userId: string, libraryId: string): string {
  return `/Items/Filters2?userId=${userId}&parentId=${libraryId}&includeItemTypes=Movie,Series&recursive=true`;
}
